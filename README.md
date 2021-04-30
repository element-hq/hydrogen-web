# Hydrogen

A minimal [Matrix](https://matrix.org/) chat client, focused on performance, offline functionality, and broad browser support. This is work in progress and not yet ready for primetime. Bug reports are welcome, but please don't file any feature requests or other missing things to be on par with Element Web.

## Goals

Hydrogen's goals are:
 - Work well on desktop as well as mobile browsers
 - UI components can be easily used in isolation
 - It is a standalone webapp, but can also be easily embedded into an existing website/webapp to add chat capabilities.
 - Loading (unused) parts of the application after initial page load should be supported

If you find this interesting, come and discuss on [`#hydrogen:matrix.org`](https://matrix.to/#/#hydrogen:matrix.org).

# How to use

Hydrogen is deployed to [hydrogen.element.io](https://hydrogen.element.io). You can run it locally `yarn install` (only the first time) and `yarn start` in the terminal, and point your browser to `http://localhost:3000`. If you prefer, you can also [use docker](doc/docker.md).

Hydrogen uses symbolic links in the codebase, so if you are on Windows, have a look at [making git & symlinks work](https://github.com/git-for-windows/git/wiki/Symbolic-Links) there.

# FAQ

Some frequently asked questions are answered [here](doc/FAQ.md).
