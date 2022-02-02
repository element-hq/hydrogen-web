FROM --platform=${BUILDPLATFORM} docker.io/library/node:16.13-alpine3.15 as builder
RUN apk add --no-cache git python3 build-base
WORKDIR /app

# Install the dependencies first
COPY yarn.lock package.json ./
RUN yarn install

# Copy the rest and build the app
COPY . .
RUN yarn build

FROM --platform=${TARGETPLATFORM} docker.io/nginxinc/nginx-unprivileged:1.21-alpine
COPY --from=builder /app/target /usr/share/nginx/html

# Values from the default config that can be overridden at runtime
ENV PUSH_APP_ID="io.element.hydrogen.web" \
    PUSH_GATEWAY_URL="https://matrix.org" \
    PUSH_APPLICATION_SERVER_KEY="BC-gpSdVHEXhvHSHS0AzzWrQoukv2BE7KzpoPO_FfPacqOo3l1pdqz7rSgmB04pZCWaHPz7XRe6fjLaC-WPDopM" \
    DEFAULT_HOMESERVER="matrix.org"
