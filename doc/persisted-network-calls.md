# General Pattern of implementing a persisted network call

 1. do network request
 1. start transaction
 1. write result of network request into transaction store, keeping differences from previous store state in local variables
 1. close transaction
 1. apply differences applied to store to in-memory data
 1. emit events for changes
