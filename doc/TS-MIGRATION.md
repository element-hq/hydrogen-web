# Typescript style guide

## Use `type` rather than `interface` for named parameters and POJO return values.

`type` and `interface` can be used somewhat interchangeably, but let's use `type` to describe data and `interface` to describe (polymorphic) behaviour.

Good examples of data are option objects to have named parameters, and POJO (plain old javascript objects) without any methods, just fields.

Also see [this playground](https://www.typescriptlang.org/play?#code/C4TwDgpgBACghgJwgO2AeTMAlge2QZygF4oBvAKCiqmTgFsIAuKfYBLZAcwG5LqATCABs4IAPzNkAVzoAjCAl4BfcuVCQoAYQAWWIfwzY8hEvCSpDuAlABkZPlQDGOITgTNW7LstWOR+QjMUYHtqKGcCNilHYDcAChxMK3xmIIsk4wBKewcoFRVyPzgArV19KAgAD2AUfkDEYNDqCM9o2IQEjIJmHT0DLvxsijCw-ClIDsSjAkzeEebjEIYAuE5oEgADABJSKeSAOloGJSgsQh29433nVwQlDbnqfKA)

## Use `Record<string, any>` to describe a type that accepts any Javascript object.

Record<string, any> allows us to avoid passing in primitive types and prevents type errors when accessing properties. As this is a temporary type while converting javascript, it seems best to not add any additional requirements. If any errors occur, they must have already been present, and we should fix it by adding proper types. So prefer `Record<string, any>` over `[key: string]: any`, `any` or `object`.
