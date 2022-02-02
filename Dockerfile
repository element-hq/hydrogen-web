FROM --platform=${BUILDPLATFORM} docker.io/library/node:16.13-alpine3.15 as builder
RUN apk add --no-cache git python3 build-base
WORKDIR /app

# Install the dependencies first
COPY yarn.lock package.json ./
RUN yarn install

# Copy the rest and build the app
COPY . .
RUN yarn build

# Remove the default config, replace it with a symlink to somewhere that will be updated at runtime
RUN rm -f target/assets/config.json \
    && ln -sf /tmp/config.json target/assets/config.json

FROM --platform=${TARGETPLATFORM} docker.io/nginxinc/nginx-unprivileged:1.21-alpine

# Copy the config template as well as the templating script
COPY ./docker/config.json.tmpl /config.json.tmpl
COPY ./docker/config-template.sh /docker-entrypoint.d/99-config-template.sh

# Copy the built app from the first build stage
COPY --from=builder /app/target /usr/share/nginx/html

# Values from the default config that can be overridden at runtime
ENV PUSH_APP_ID="io.element.hydrogen.web" \
    PUSH_GATEWAY_URL="https://matrix.org" \
    PUSH_APPLICATION_SERVER_KEY="BC-gpSdVHEXhvHSHS0AzzWrQoukv2BE7KzpoPO_FfPacqOo3l1pdqz7rSgmB04pZCWaHPz7XRe6fjLaC-WPDopM" \
    DEFAULT_HOMESERVER="matrix.org"
