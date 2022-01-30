FROM docker.io/node:17.4.0-alpine as builder
RUN apk add --no-cache git python3 build-base
COPY . /app
WORKDIR /app
RUN yarn install \
 && yarn build

FROM docker.io/nginx:1.21.6-alpine
COPY --from=builder /app/target /usr/share/nginx/html
