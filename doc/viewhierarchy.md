view hierarchy:
```
    BrawlView
        SwitchView
            SessionView
                SyncStatusBar
                ListView(left-panel)
                    RoomTile
                SwitchView
                    RoomPlaceholderView
                    RoomView
                        MiddlePanel
                            ListView(timeline)
                                event tiles (see ui/session/room/timeline/)
                            ComposerView
                        RightPanel
            SessionPickView
                ListView
                    SessionPickerItemView
            LoginView
```
