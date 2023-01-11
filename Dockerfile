FROM docker.io/node:alpine as builder
RUN apk add --no-cache git python3 build-base
COPY . /app
WORKDIR /app
RUN yarn install \
 && yarn build

FROM docker.io/nginx:alpine

# Copy the dynamic config script
COPY ./docker/dynamic-config.sh /docker-entrypoint.d/99-dynamic-config.sh

# Copy the built app from the first build stage
COPY --from=builder /app/target /usr/share/nginx/html
