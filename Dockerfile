FROM docker.io/node:alpine as builder
RUN apk add --no-cache git python3 build-base

WORKDIR /app

# Copy package.json and yarn.lock and install dependencies first to speed up subsequent builds
COPY package.json yarn.lock /app/
RUN yarn install

COPY . /app
RUN yarn build

FROM docker.io/nginx:alpine
COPY --from=builder /app/target /usr/share/nginx/html
