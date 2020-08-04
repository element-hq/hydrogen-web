# Hydrogen

A minimal [Matrix](https://matrix.org/) chat client, focused on performance, offline functionality, and broad browser support.

## Status

Hydrogen can currently log you in, or pick an existing session, sync already joined rooms, fill gaps in the timeline, and send text messages. Everything is stored locally.

## Why

For every interaction or network response (syncing, filling a gap), Hydrogen starts a transaction in indexedb, and only commits it once everything went well. This helps to keep your storage always in a consistent state. As little data is kept in memory as well, and while scrolling in the above GIF, everything is loaded straight from the storage.

If you find this interesting, feel free to reach me at `@bwindels:matrix.org`.

# How to use

Try it locally by running `yarn install` (only the first time) and `yarn start` in the terminal, and point your browser to `http://localhost:3000`.
