# View updates

## Current situation

 - arguments of View.update are not standardized, it's either:
    - name of property that was updated on viewmodel
    - names of property that was updated on viewmodel
    - map of updated values
 - we have 2 update mechanisms:
    - listening on viewmodel change event
    - through ObservableCollection which parent view listens on and calls `update(newValue)` on the child view. This is an optimization to prevent every view in a collection to need to subscribe and unsubscribe to a viewmodel.

 - should updates on a template value propagate to subviews?
 - either a view listens on the view model, ...
 - or waits for updates from parent view:
    - item view in a list view
    - subtemplate (not needed, we could just have 2 subscriptions!!)

ok, we always subscribe in a (sub)template. But for example RoomTile and it's viewmodel; RoomTileViewModel doesn't extend EventEmitter or ObservableValue today because it (would) emit(s) updates through the parent collection. So today it's view would not subscribe to it. But if it wants to extend ViewModel to have all the other infrastructure, you'd receive double updates.

I think we might need to make it explicit whether or not the parent will provide updates for the children or not. Maybe as a mount() parameter? Yeah, I like that. ListView would pass in `true`. Most other things would pass in `false`/`undefined`. `Template` can then choose to bind or not based on that param.

Should we make a base/subclass of Template that does not do event binding to save a few bytes in memory for the event subscription fields that are not needed? Not now, this is less ergonimic, and a small optimization. We can always do that later, and we'd just have to replace the base class of the few views that appear in a `ListView`.
