# Error handling

Ideally, every error that is unexpected and can't be automatically recovered from without degrading the experience is shown in the UI. This is the task of the view model, and you can use `ErrorReportViewModel`, a dedicated base view model class for this purpose. It exposes a child view model, `ErrorViewModel`, when `reportError` is called which can be paired with `ErrorView` in the view to present an error message from which debug logs can also be sent.

Methods on classes from the `matrix` layer can often throw errors and those errors should be caught in the view model and reported with `reportError`. As a convenience method, there is also `logAndCatch` which calls a callback within a log item and also a try catch that reports the error.

## Sync errors

There are some errors that are throw during background processes though, most notably the sync loop. These processes are not triggered by the view model directly, and hence there is not always a method call they can wrap in a try/catch. For this, there is the `ErrorBoundary` utility class. Since almost all aspects of the client can be updated through the sync loop, it is not too helpful if there is only one try/catch around the whole sync and we stop sync if something goes wrong.

Instead, it's more helpful to split up the error handling into different scopes, where errors are stored and not rethrown when leaving the scope. One example is to have a scope per room. In this way, we can isolate an error occuring during sync to a specific room, and report it in the UI of that room.

There is an extra complication though. The `writeSync` sync lifecycle step should not swallow any errors, or data loss can occur. This is because the whole `writeSync` lifecycle step is writes all changes (for all rooms, the session, ...) for a sync response in one transaction. This includes the sync token. So if there is an error in `writeSync` of a given room preventing storing all changes the sync response would cause,