FROM node:alpine3.12
RUN apk add --no-cache git
COPY . /code
WORKDIR /code
RUN yarn install
EXPOSE 3000
ENTRYPOINT ["yarn", "start"]
