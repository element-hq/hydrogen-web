view hierarchy:
```
    BrawlView
        SwitchView
            SessionView
                SyncStatusBar
                ListView(left-panel)
                SwitchView
                    RoomPlaceholderView
                    RoomView
                        MiddlePanel
                            ListView(timeline)
                            ComposerView
                        RightPanel
            SessionStartView
                SessionPickView
                LoginView
```

 - DONE: support isOwn on message view model
 - DONE: put syncstatusbar in sessionview
 - DONE: apply css to app
 - DONE: keep scroll at bottom
 - DONE: hide sender if repeated
 - DONE: show date somehow
 - DONE: start scrolled down when opening room
