# "Room" view models

InviteViewModel, RoomViewModel and RoomBeingCreatedViewModel are interchangebly used as "room view model":
    - SessionViewModel.roomViewModel can be an instance of any
    - RoomGridViewModel.roomViewModelAt(i) can return an instance of any

This is because they are accessed by the same url and need to transition into each other, in these two locations. Having two methods, especially in RoomGridViewModel would have been more cumbersome, even though this is not in line with how different view models are exposed in SessionViewModel.

They share a common interface defined in [`IGridItemViewModel.ts`](./IGridItemViewModel.ts)
