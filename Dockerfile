FROM --platform=${BUILDPLATFORM} docker.io/library/node:16.13-alpine3.15 as builder
RUN apk add --no-cache git python3 build-base
WORKDIR /app

# Install the dependencies first
COPY yarn.lock package.json ./
RUN yarn install

# Copy the rest and build the app
COPY . .
RUN yarn build

FROM --platform=${TARGETPLATFORM} docker.io/library/nginx:alpine
COPY --from=builder /app/target /usr/share/nginx/html
