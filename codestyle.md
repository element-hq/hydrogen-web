
# Code-style

 - methods that return a promise should always use async/await
    otherwise synchronous errors can get swallowed
    you can return a promise without awaiting it though.
 - only named exports, no default exports
    otherwise it becomes hard to remember what was a default/named export
 - should we return promises from storage mutation calls? probably not, as we don't await them anywhere. only read calls should return promises?
    - we don't anymore
 - don't use these features, as they are not widely enough supported.
    - [lookbehind in regular expressions](https://caniuse.com/js-regexp-lookbehind)
