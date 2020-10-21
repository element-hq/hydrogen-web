# Hydrogen

A minimal [Matrix](https://matrix.org/) chat client, focused on performance, offline functionality, and broad browser support. This is work in progress and not yet ready for primetime. Bug reports are welcome, but please don't file any feature requests or other missing things to be on par with Element Web.

## Goals

Hydrogen's goals are:
 - Work well on desktop as well as mobile browsers
 - UI components can be easily used in isolation
 - It is a standalone webapp, but can also be easily embedded into an existing website/webapp to add chat capabilities.
 - Loading (unused) parts of the application after initial page load should be supported

If you find this interesting, come and discuss on `#hydrogen:matrix.org`.

# How to use

Hydrogen is deployed to [hydrogen.element.io](https://hydrogen.element.io). You can run it locally with `yarn install` (only the first time) and `yarn start` in the terminal, and point your browser to `http://localhost:3000`.

You can also use Docker to create a local dev environment.

In this repository, create a Docker image:

    docker build -t hydrogen .

Then start up a container from that image:

    docker run \
        --name hydrogen-dev \
        --publish 3000:3000 \
        --volume "$PWD":/code \
        --interactive \
        --tty \
        --rm \
        hydrogen

Then point your browser to `http://localhost:3000`. You can see the server logs in the terminal where you started the container.

To stop the container, simply hit `ctrl+c`.
