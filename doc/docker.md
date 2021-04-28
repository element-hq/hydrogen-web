## Warning

Usage of docker is a third-party contribution and not actively tested, used or supported by the main developer(s).

Having said that, you can also use Docker to create a local dev environment or a production deployment.

## Dev environment

In this repository, create a Docker image:

```
docker build -t hydrogen-dev -f Dockerfile-dev .
```

Then start up a container from that image:

```
docker run \
    --name hydrogen-dev \
    --publish 3000:3000 \
    --volume "$PWD":/code \
    --interactive \
    --tty \
    --rm \
    hydrogen-dev
```

Then point your browser to `http://localhost:3000`. You can see the server logs in the terminal where you started the container.

To stop the container, simply hit `ctrl+c`.

## Production deployment

### Build or pull image

In this repository, create a Docker image:

```
docker build -t hydrogen .
```

Or, pull the docker image from GitLab:

```
docker pull registry.gitlab.com/jcgruenhage/hydrogen-web
docker tag registry.gitlab.com/jcgruenhage/hydrogen-web hydrogen
```

### Start container image

Then, start up a container from that image:

```
docker run \
    --name hydrogen \
    --publish 80:80 \
    hydrogen
```
