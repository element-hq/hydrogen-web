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

```sh
# Enable BuildKit https://docs.docker.com/develop/develop-images/build_enhancements/
export DOCKER_BUILDKIT=1
docker build -t hydrogen .
```

Or, pull the docker image from GitHub Container Registry:

```
docker pull ghcr.io/vector-im/hydrogen-web
docker tag ghcr.io/vector-im/hydrogen-web hydrogen
```

### Start container image

Then, start up a container from that image:

```
docker run \
    --name hydrogen \
    --publish 8080:8080 \
    hydrogen
```

n.b. the image is now based on the unprivileged nginx base, so the port is now `8080` instead of `80` and you need a writable `/tmp` volume.

You can override the default `config.json` using the `CONFIG_OVERRIDE` environment variable. For example to specify a different Homeserver and :

```
docker run \
    --name hydrogen \
    --publish 8080:8080 \
    --env CONFIG_OVERRIDE='{
  "push": {
    "appId": "io.element.hydrogen.web",
    "gatewayUrl": "https://matrix.org",
    "applicationServerKey": "BC-gpSdVHEXhvHSHS0AzzWrQoukv2BE7KzpoPO_FfPacqOo3l1pdqz7rSgmB04pZCWaHPz7XRe6fjLaC-WPDopM"
  },
  "defaultHomeServer": "https://fosdem.org",
  "themeManifests": [
    "assets/theme-element.json"
  ],
  "defaultTheme": {
    "light": "element-light",
    "dark": "element-dark"
  }
}' \
    hydrogen
```
