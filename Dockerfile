FROM docker.io/node:alpine as builder
RUN apk add --no-cache git python3 build-base
COPY . /app
WORKDIR /app
RUN yarn install \
 && yarn build

# Copy the built app from the first build stage
COPY --from=builder /app/target /usr/share/nginx/html

# Values from the default config that can be overridden at runtime
ENV PUSH_APP_ID="io.element.hydrogen.web" \
    PUSH_GATEWAY_URL="https://matrix.org" \
    PUSH_APPLICATION_SERVER_KEY="BC-gpSdVHEXhvHSHS0AzzWrQoukv2BE7KzpoPO_FfPacqOo3l1pdqz7rSgmB04pZCWaHPz7XRe6fjLaC-WPDopM" \
    DEFAULT_HOMESERVER="matrix.org"
