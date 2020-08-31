
# Code-style

 - methods that return a promise should always use async/await
    otherwise synchronous errors can get swallowed
 - only named exports, no default exports
    otherwise it becomes hard to remember what was a default/named export
