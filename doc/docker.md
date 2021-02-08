Usage of docker is a third-party contribution and not actively tested, used or supported by the main developer(s).

Having said that, you can also use Docker to create a local dev environment.

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
