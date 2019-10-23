# Minimal thing to get working

 - DONE: finish summary store
 - DONE: move "sdk" bits over to "matrix" directory
 - DONE: add eventemitter
 - DONE: make sync work
 - DONE: store summaries
 - DONE: setup editorconfig
 - DONE: setup linting (also in editor)
 - DONE: store timeline
 - DONE: store state
 - DONE: make summary work better (name and joined/inviteCount doesn't seem to work well)
 - DONE: timeline doesn't seem to recover it's key well upon loading, the query in load seems to never yield an event in the persister
 - DONE: map DOMException to something better
 	- it's pretty opaque now when something idb related fails. DOMException has these fields:
 		code: 0
		message: "Key already exists in the object store."
		name: "ConstraintError"
 - DONE: emit events so we can start showing something on the screen maybe?
 - DONE: move session._rooms over to Map, so we can iterate over it, ...
 - DONE: build a very basic interface with
 	- DONE: a start/stop sync button
 	- DONE: a room list sorted alphabetically
 - DONE: do some preprocessing on sync response which can then be used by persister, summary, timeline
 - DONE: support timeline
 	- DONE: clicking on a room list, you see messages (userId -> body)
 - DONE: style minimal UI
 - DONE: implement gap filling and fragments (see FRAGMENTS.md)
 - DONE: allow collection items (especially tiles) to self-update
 - improve fragmentidcomparer::add
 - DONE: better UI
 - fix MappedMap update mechanism
 - see if in BaseObservableMap we need to change ...params
 - DONE: put sync button and status label inside SessionView
 - fix some errors:
    - find out if `(this._emitCollectionUpdate)(this)` is different than `this._emitCollectionUpdate(this)` 
    - got "database tried to mutate when not allowed" or something error as well
    - find out why when RoomPersister.(\_createGapEntry/\_createEventEntry) we remove .buffer the transaction fails (good), but upon fixing and refreshing is missing a message! syncToken should not be saved, so why isn't this again in the sync response and now the txn does succeed?
 - DONE: take access token out of IDB? this way it can be stored in a more secure thing for non-web clients, together wit encryption key for olm sessions ... ? like macos keychain, gnome keyring, ... maybe using https://www.npmjs.com/package/keytar
 - DONE: experiment with using just a normal array with 2 numbers for sortkeys, to work in Edge as well.
 - DONE: send messages
 - DONE: fill gaps with call to /messages

 - DONE: build script
    - DONE: take dev index.html, run some dom modifications to change script tag with `parse5`.
    - DONE: create js bundle, rollup
    - DONE: create css bundle, postcss, probably just need postcss-import for now, but good to have more options
    - DONE: put all in /target
    - have option to run it locally to test

 - deploy script
    - upload /target to github pages

 - DONE: offline available
    - both offline mechanisms have (filelist, version) as input for their template:
        - create appcache manifest with (index.html, brawl.js, brawl.css) and print version number in it
        - create service worker wit file list to cache (at top const files = "%%FILES_ARRAY%%", version = "%%VERSION%%")
        - write web manifest
 - DONE: delete and clear sessions from picker
 - option to close current session and go back to picker
 
 - accept invite
 - member list
 - e2e encryption
 - sync retry strategy
    - instead of stopping sync on fetch error, show spinner and status and have auto retry strategy

 - create room
 - join room
 - leave room
 - unread rooms, badge count, sort rooms by activity

 - DONE: create sync filter
 - DONE: lazy loading members
 - decide denormalized data in summary vs reading from multiple stores PER room on load
 - allow Room/Summary class to be subclassed and store additional data?
 - store account data, support read markers
