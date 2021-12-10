# Typescript style guide

## Use `type` rather than `interface` for named parameters and POJO return values.

`type` and `interface` can be used somewhat interchangeably, but let's use `type` to describe data and `interface` to describe (polymorphic) behaviour.

Good examples of data are option objects to have named parameters, and POJO (plain old javascript objects) without any methods, just fields.

Also see [this playground](https://www.typescriptlang.org/play?#code/C4TwDgpgBACghgJwgO2AeTMAlge2QZygF4oBvAKCiqmTgFsIAuKfYBLZAcwG5LqATCABs4IAPzNkAVzoAjCAl4BfcuVCQoAYQAWWIfwzY8hEvCSpDuAlABkZPlQDGOITgTNW7LstWOR+QjMUYHtqKGcCNilHYDcAChxMK3xmIIsk4wBKewcoFRVyPzgArV19KAgAD2AUfkDEYNDqCM9o2IQEjIJmHT0DLvxsijCw-ClIDsSjAkzeEebjEIYAuE5oEgADABJSKeSAOloGJSgsQh29433nVwQlDbnqfKA)

## Use `type foo = { [key: string]: any }` for types that you intend to fill in later.

For instance, if you have a method such as:
```js
    function load(options) {
        // ...
    }
```
and you intend to type options at some later point, do:
```ts
    type Options = { [key: string]: any}
```
This makes it much easier to add the necessary type information at a later time.

## Use `object` or `Record<string, any>` to describe a type that accepts any javascript object.

Sometimes a function or method may genuinely need to accept any object; eg:
```js
function encodeBody(body) {
    // ...
}
```
In this scenario:
- Use `object` if you know that you will not access any property
- Use `Record<string, any>` if you need to access some property

Both usages prevent the type from accepting primitives (eg: string, boolean...).  
If using `Record`, ensure that you have guards to check that the properties really do exist.
