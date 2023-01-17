## IView components

The [interface](https://github.com/vector-im/hydrogen-web/blob/master/src/platform/web/ui/general/types.ts) adopted by view components is agnostic of how they are rendered to the DOM. This has several benefits:
 - it allows Hydrogen to not ship a [heavy view framework](https://bundlephobia.com/package/react-dom@18.2.0) that may or may not be used by its SDK users, and also keep bundle size of the app down.
 - Given the interface is quite simple, is should be easy to integrate this interface into the render lifecycle of other frameworks.
 - The main implementations used in Hydrogen are [`ListView`](https://github.com/vector-im/hydrogen-web/blob/master/src/platform/web/ui/general/ListView.ts) (rendering [`ObservableList`](https://github.com/vector-im/hydrogen-web/blob/master/src/observable/list/BaseObservableList.ts)s) and [`TemplateView`](https://github.com/vector-im/hydrogen-web/blob/master/src/platform/web/ui/general/TemplateView.ts) (templating and one-way databinding), each only a few 100 lines of code and tailored towards their specific use-case. They work straight with the DOM API and have no other dependencies.
 - a common inteface allows us to mix and match between these different implementations (and gradually shift if need be in the future) with the code.

## Templates

### Template language

Templates use a mini-DSL language in pure javascript to express declarative templates. This is basically a very thin wrapper around `document.createElement`, `document.createTextNode`, `node.setAttribute` and `node.appendChild` to quickly create DOM trees. The general syntax is as follows:
```js
t.tag_name({attribute1: value, attribute2: value, ...}, [child_elements]);
t.tag_name(child_element);
t.tag_name([child_elements]);
```
**tag_name** can be [most HTML or SVG tags](https://github.com/vector-im/hydrogen-web/blob/master/src/platform/web/ui/general/html.ts#L102-L110).

eg:
Here is an example HTML segment followed with the code to create it in Hydrogen.
```html
<section class="main-section">
    <h1>Demo</h1>
    <button class="btn_cool">Click me</button>
</section>
```
```js
t.section({className: "main-section"},[
    t.h1("Demo"), 
    t.button({className:"btn_cool"}, "Click me")
]);
```

All these functions return DOM element nodes, e.g. the result of `document.createElement`.

### TemplateView

`TemplateView` builds on top of templating by adopting the IView component model and adding event handling attributes, sub views and one-way databinding.
In views based on `TemplateView`, you will see a render method with a `t` argument.  
`t` is `TemplateBuilder` object passed to the render function in `TemplateView`. It also takes a data object to render and bind to, often called `vm`, short for view model from the MVVM pattern Hydrogen uses.

You either subclass `TemplateView` and override the `render` method:
```js
class MyView extends TemplateView {
    render(t, vm) {
        return t.div(...);
    }
}
```

Or you pass a render function to `InlineTemplateView`:
```js
new InlineTemplateView(vm, (t, vm) => {
    return t.div(...);
});
```

**Note:** the render function is only called once to build the initial DOM tree and setup bindings, etc ... Any subsequent updates to the DOM of a component happens through bindings.

#### Event handlers

Any attribute starting with `on` and having a function as a value will be attached as an event listener on the given node. The event handler will be removed during unmounting.

```js
t.button({onClick: evt => {
    vm.doSomething(evt.target.value);
}}, "Click me");
```

#### Subviews

`t.view(instance)` will mount the sub view (can be any IView) and return its root node so it can be attached in the DOM tree.
All subviews will be unmounted when the parent view gets unmounted.

```js
t.div({className: "Container"}, t.view(new ChildView(vm.childViewModel)));
```

#### One-way data-binding

A binding couples a part of the DOM to a value on the view model. The view model emits an update when any of its properties change, to which the view can subscribe. When an update is received by the view, it will reevaluate all the bindings, and update the DOM accordingly.

A binding can appear in many places where a static value can usually be used in the template tree.
To create a binding, you pass a function that maps the view value to a static value.

##### Text binding

```js
t.p(["I've got ", vm => vm.counter, " beans"])
```

##### Attribute binding

```js
t.button({disabled: vm => vm.isBusy}, "Submit");
```

##### Class-name binding
```js
t.div({className: {
    button: true,
    active: vm => vm.isActive
}})
```
##### Subview binding

So far, all the bindings can only change node values within our tree, but don't change the structure of the DOM. A sub view binding allows you to conditionally add a subview based on the result of a binding function.

All sub view bindings return a DOM (element or comment) node and can be directly added to the DOM tree by including them in your template.

###### map

`t.mapView` allows you to choose a view based on the result of the binding function:

```js
t.mapView(vm => vm.count, count => {
    return count > 5 ? new LargeView(count) : new SmallView(count);
});
```

Every time the first or binding function returns a different value, the second function is run to create a new view to replace the previous view.

You can also return `null` or `undefined` from the second function to indicate a view should not be rendered. In this case a comment node will be used as a placeholder.

There is also a `t.map` which will create a new template view (with the same value) and you directly provide a render function for it:

```js
t.map(vm => vm.shape, (shape, t, vm) => {
    switch (shape) {
        case "rect": return t.rect();
        case "circle": return t.circle();
    }
})
```

###### if

`t.ifView` will render the subview if the binding returns a truthy value:

```js
t.ifView(vm => vm.isActive, vm => new View(vm.someValue));
```

You equally have `t.if`, which creates a `TemplateView` and passes you the `TemplateBuilder`:

```js
t.if(vm => vm.isActive, (t, vm) => t.div("active!"));
```

##### Side-effects

Sometimes you want to imperatively modify your DOM tree based on the value of a binding.
`mapSideEffect` makes this easy to do:

```js
let node = t.div();
t.mapSideEffect(vm => vm.color, (color, oldColor) => node.style.background = color);
return node;
```

**Note:** you shouldn't add any bindings, subviews or event handlers from the side-effect callback,
the safest is to not use the `t` argument at all.
If you do, they will be added every time the callback is run and only cleaned up when the view is unmounted.

#### `tag` vs `t`

If you don't need a view component with data-binding, sub views and event handler attributes, the template language also is available in `ui/general/html.js` without any of these bells and whistles, exported as `tag`. As opposed to static templates with `tag`, you always use
`TemplateView` as an instance of a class, as there is some extra state to keep track (bindings, event handlers and subviews).

Although syntactically similar, `TemplateBuilder` and `tag` are not functionally equivalent.  
Primarily `t` **supports** bindings and event handlers while `tag` **does not**. This is because to remove event listeners, we need to keep track of them, and thus we need to keep this state somewhere which
we can't do with a simple function call but we can insite the TemplateView class.

```js
    // The onClick here wont work!!
    tag.button({className:"awesome-btn", onClick: () => this.foo()});

class MyView extends TemplateView {
    render(t, vm){
        // The onClick works here.
        t.button({className:"awesome-btn", onClick: () => this.foo()});
    }
}
```

## ListView

A view component that renders and updates a list of sub views for every item in a `ObservableList`.

```js
const list = new ListView({
    list: someObservableList
}, listValue => return new ChildView(listValue))
```

As items are added, removed, moved (change position) and updated, the DOM will be kept in sync.

There is also a `LazyListView` that only renders items in and around the current viewport, with the restriction that all items in the list must be rendered with the same height.

### Sub view updates

Unless the `parentProvidesUpdates` option in the constructor is set to `false`, the ListView will call the `update` method on the child `IView` component when it receives an update event for one of the items in the `ObservableList`.

This way, not every sub view has to have an individual listener on it's view model (a value from the observable list), and all updates go from the observable list to the list view, who then notifies the correct sub view.
