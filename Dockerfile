FROM --platform=${BUILDPLATFORM} docker.io/node:alpine as builder
RUN apk add --no-cache git python3 build-base

WORKDIR /app

# Copy package.json and yarn.lock and install dependencies first to speed up subsequent builds
COPY package.json yarn.lock /app/
RUN yarn install

COPY . /app
RUN yarn build

# Because we will be running as an unprivileged user, we need to make sure that the config file is writable
# So, we will copy the default config to the /tmp folder that will be writable at runtime
RUN mv -f target/config.json /config.json.bundled \
    && ln -sf /tmp/config.json target/config.json

FROM --platform=${TARGETPLATFORM} docker.io/nginxinc/nginx-unprivileged:alpine

# Copy the dynamic config script
COPY ./docker/dynamic-config.sh /docker-entrypoint.d/99-dynamic-config.sh
# And the bundled config file
COPY --from=builder /config.json.bundled /config.json.bundled

# Copy the built app from the first build stage
COPY --from=builder /app/target /usr/share/nginx/html

# Values from the default config that can be overridden at runtime
ENV PUSH_APP_ID="io.element.hydrogen.web" \
    PUSH_GATEWAY_URL="https://matrix.org" \
    PUSH_APPLICATION_SERVER_KEY="BC-gpSdVHEXhvHSHS0AzzWrQoukv2BE7KzpoPO_FfPacqOo3l1pdqz7rSgmB04pZCWaHPz7XRe6fjLaC-WPDopM" \
    DEFAULT_HOMESERVER="matrix.org"
