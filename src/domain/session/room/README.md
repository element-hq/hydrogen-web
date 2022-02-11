# "Room" view models

InviteViewModel, RoomViewModel and RoomBeingCreatedViewModel are interchangebly used as "room view model":
    - SessionViewModel.roomViewModel can be an instance of any
    - RoomGridViewModel.roomViewModelAt(i) can return an instance of any

This is because they are accessed by the same url and need to transition into each other, in these two locations. Having two methods, especially in RoomGridViewModel would have been more cumbersome, even though this is not in line with how different view models are exposed in SessionViewModel.

They share an `id` and `kind` property, the latter can be used to differentiate them from the view, and a `focus` method.
Once we convert this folder to typescript, we should use this interface for all the view models:
```ts
interface IGridItemViewModel {
    id: string;
    kind: string;
    focus();
}
```
