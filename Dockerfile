FROM --platform=${BUILDPLATFORM} docker.io/node:alpine as builder
RUN apk add --no-cache git python3 build-base

WORKDIR /app

# Copy package.json and yarn.lock and install dependencies first to speed up subsequent builds
COPY package.json yarn.lock /app/
RUN yarn install

COPY . /app
RUN yarn build

FROM --platform=${BUILDPLATFORM} docker.io/nginx:alpine

# Copy the dynamic config script
COPY ./docker/dynamic-config.sh /docker-entrypoint.d/99-dynamic-config.sh

# Copy the built app from the first build stage
COPY --from=builder /app/target /usr/share/nginx/html
