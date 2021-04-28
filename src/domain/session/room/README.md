# "Room" view models

InviteViewModel and RoomViewModel are interchangebly used as "room view model":
    - SessionViewModel.roomViewModel can be an instance of either
    - RoomGridViewModel.roomViewModelAt(i) can return an instance of either

This is because they are accessed by the same url and need to transition into each other, in these two locations. Having two methods, especially in RoomGridViewModel would have been more cumbersome, even though this is not in line with how different view models are exposed in SessionViewModel.

They share an `id` and `kind` property, the latter can be used to differentiate them from the view, and a `focus` method.
