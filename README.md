# Hydrogen

A minimal [Matrix](https://matrix.org/) chat client, focused on performance, offline functionality, and broad browser support.

## Goals

Hydrogen's goals are:
 - Work well on desktop as well as mobile browsers
 - UI components can be easily used in isolation
 - It is a standalone webapp, but can also be easily embedded into an existing website/webapp to add chat capabilities.
 - Loading (unused) parts of the application after initial page load should be supported

## Status

Hydrogen can currently log you in, or pick an existing session, sync already joined rooms, fill gaps in the timeline, and send text messages. Everything is stored locally.

## Why

For every interaction or network response (syncing, filling a gap), Hydrogen starts a transaction in indexedb, and only commits it once everything went well. This helps to keep your storage always in a consistent state. As little data is kept in memory as well, and while scrolling in the above GIF, everything is loaded straight from the storage.

If you find this interesting, feel free to reach me at `@bwindels:matrix.org`.

# How to use

Try it locally by running `npm install dev` (only the first time) and `npm start` in the terminal, and point your browser to `http://localhost:3000`.
