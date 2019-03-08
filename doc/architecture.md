The matrix layer consists of a `Session`, which represents a logged in user session. It's the root object you can get rooms off. It can persist and load itself from storage, at which point it's ready to be displayed. It doesn't sync it's own though, and you need to create and start a Sync object for updates to be pushed and persisted to the session. `Sync` is the thing (although not the only thing) that mutates the `Session`, with `Session` being unaware of `Sync`.

The matrix layer assumes a transaction-based storage layer, modelled much to how IndexedDB works. The idea is that any logical operation like process sync response, send a message, ... runs completely in a transaction that gets aborted if anything goes wrong. This helps the storage to always be in a consistent state. For this reason you'll often see transactions (txn) being passed in the code. Also, the idea is to not emit any events until readwrite transactions have been committed. 

 - Reduce the chance that errors (in the event handlers) abort the transaction. You *could* catch & rethrow but it can get messy.
 - Try to keep transactions as short-lived as possible, to not block other transactions.

For this reason a `Room` processes a sync response in two phases: `persistSync` & `emitSync`, with the return value of the former being passed into the latter to avoid double processing.

`Room`s on the `Session` are exposed as an `ObservableMap` collection, which is like an ordinary `Map` but emits events when it is modified (here when a room is added, removed, or the properties of a room change). `ObservableMap` can have different operators applied to it like `mapValues()`, `filterValues()` each returning a new `ObservableMap`-like object, and also `sortValues()` returning an `ObservableList` (emitting events when a room at an index is added, removed, moved or changes properties).

So example, for the room list, `Room` objects from `Session.rooms` are mapped to a `RoomTileViewModel` and then sorted. This gives us fine-grained events at the end of the collection chain that can be easily and efficiently rendered by the `ListView` component.

On that note, view components are just a simple convention, having these methods:

    - `mount()` - prepare to become part of the document and interactive, ensure `root()` returns a valid DOM node.
    - `root()` - the room DOM node for the component. Only valid to be called between `mount()` and `unmount()`.
    - `update(attributes)` (to be renamed to `setAttributes(attributes)`) - update the attributes for this component. Not all components support all attributes to be updated. For example most components expect a viewModel, but if you want a component with a different view model, you'd just create a new one.
    - `unmount()` - tear down after having been removed from the document.

The initial attributes are usually received by the constructor in the first argument. Other arguments are usually freeform, `ListView` accepting a closure to create a child component from a collection value.

Templating and one-way databinding are neccesary improvements, but not assumed by the component contract.

Updates from view models can come in two ways. View models emit a change event, that can be listened to from a view. This usually includes the name of the property that changed. This is the mechanism used to update the room name in the room header of the currently active room for example.

For view models part of an observable collection (and to be rendered by a ListView), updates can also propagate through the collection and delivered by the ListView to the view in question. This avoids every child component in a ListView having to attach a listener to it's viewModel. This is the mechanism to update the room name in a RoomTile in the room list for example.

TODO: specify how the collection based updates work.
