goal:

to write a minimal matrix client that should you all your rooms, allows you to pick one and read and write messages in it.

on the technical side, the goal is to go low-memory, and test the performance of storing every event individually in indexeddb.

nice properties of this approach:

easy to delete oldest events when db becomes certain size/full (do we need new pagination token after deleting oldest? how to do that)

sync is persisted in one transaction, so you always have state at some sync_token