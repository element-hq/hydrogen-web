# Updates

How updates flow from the model to the view model to the UI.

## EventEmitter, single values

When interested in updates from a single object, chances are it inherits from `EventEmitter` and it supports a `change` event.

`ViewModel` by default follows this pattern, but it can be overwritten, see Collections below.

### Parameters

Often a `parameters` or `params` argument is passed with the name of the field who's value has now changed. This parameter is currently only sometimes used, e.g. when it is too complicated or costly to check every possible field. An example of this is `TilesListView.onUpdate` to see if the `shape` property of a tile changed and hence the view needs to be recreated. Other than that, bindings in the web UI just reevaluate all bindings when receiving an update. This is a soft convention that could probably be more standardized, and it's not always clear what to pass (e.g. when multiple fields are being updated).

Another reason to keep this convention around is that if one day we decide to add support for a different platform with a different UI, it may not be feasible to reevaluate all data-bindings in the UI for a given view model when receiving an update.

## Collections

As an optimization, Hydrogen uses a pattern to let updates flow over an observable collection where this makes sense. There is an `update` event for this in both `ObservableMap` and `ObservableList`. This prevents having to listen for updates on each individual item in large collections. The `update` event uses the same `params` argument as explained above.

Some values like `BaseRoom` emit both with a `change` event on the event emitter and also over the collection. This way consumers can use what fits best for their case: the left panel can listen for updates on the room over the collection to power the room list, and the room view model can listen to the event emitter to get updates from the current room only.

### MappedMap and mapping models to `ViewModel`s

This can get a little complicated when using `MappedMap`, e.g. when mapping a model from `matrix/`
to a view model in `domain/`. Often, view models will want to emit updates _spontanously_,
e.g. without a prior update being sent from the lower-lying model. An example would be to change the value of a field after the view has called a method on the view model.
To support this pattern while having updates still flow over the collection requires some extra work;
`ViewModel` has a `emitChange` option which you can pass in to override
what `ViewModel.emitChange` does (by default it emits the `change` event on the view model).
`MappedMap` passes a callback to emit an update over the collection to the mapper function.
You can pass this callback as the `emitChange` option and updates will now flow over the collection.

`MappedMap` also accepts an updater function, which you can use to make the view model respond to updates
from the lower-lying model.

Here is an example:

```ts
const viewModels = someCollection.mapValues(
	    (model, emitChange) => new SomeViewModel(this.childOptions({
	        model,
	        // will make ViewModel.emitChange go over
	        // the collection rather than emit a "change" event
	        emitChange,
	    })),
	    // an update came in from the model, let the vm know
	    (vm: SomeViewModel) => vm.onUpdate(),
	);
```

### `ListView` & the `parentProvidesUpdates` flag.

`ObservableList` is always rendered in the UI using `ListView`. When receiving an update over the collection, it will find the child view for the given index and call `update(params)` on it. Views will typically need to be told whether they should listen to the `change` event in their view model or rather wait for their `update()` method to be called by their parent view, `ListView`. That's why the `mount(args)` method on a view supports a `parentProvidesUpdates` flag. If `true`, the view should not subscribe to its view model, but rather updates the DOM when its `update()` method is called. Also see `BaseUpdateView` and `TemplateView` for how this is implemented in the child view.

## `ObservableValue`

When some method wants to return an object that can be updated, often an `ObservableValue` is used rather than an `EventEmitter`. It's not 100% clear cut when to use the former or the latter, but `ObservableValue` is often used when the returned value in it's entirety will change rather than just a property on it.  `ObservableValue` also has some nice facilities like lazy evaluation when subscribed to and the `waitFor` method to work with promises.