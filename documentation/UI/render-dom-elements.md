There are two options to render DOM elements:
- Use `tag` from `ui/general/html.js`
- Use `TemplateBuilder` object (t) from the render function in the view.

Although syntactically similar, they are not functionally equivalent.  
Primarily `tag` **does not support** bindings nor event handlers.

```js
    // The onClick here wont work!!
    tag.button({className:"awesome-btn", onClick: () => this.foo()});
```
 For these functionalities always use the TemplateBuilder object that is passed as argument to the render method.
```js
    render(t, vm){
        // The onClick works here.
        t.button({className:"awesome-btn", onClick: () => this.foo()});
    }
```
