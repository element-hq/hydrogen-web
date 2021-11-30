# Typescript migration
 
## Introduce `abstract` & `override`

 - find all methods and getters that throw or are empty in base classes and turn into abstract method or if all methods are abstract, into an interface.
 - change child impls to not call super.method and to add override
 - don't allow implicit override in ts config

## Use `type` rather than `interface` for named parameters and POJO return values.

`type` and `interface` can be used somewhat interchangebly used, but let's use `type` to describe data and `interface` to describe (polymorphic) behaviour.

Good examples of data are option objects to have named parameters, and POJO (plain old javascript objects) without any methods, just fields.

Also see [this playground](https://www.typescriptlang.org/play?#code/C4TwDgpgBACghgJwgO2AeTMAlge2QZygF4oBvAKCiqmTgFsIAuKfYBLZAcwG5LqATCABs4IAPzNkAVzoAjCAl4BfcuVCQoAYQAWWIfwzY8hEvCSpDuAlABkZPlQDGOITgTNW7LstWOR+QjMUYHtqKGcCNilHYDcAChxMK3xmIIsk4wBKewcoFRVyPzgArV19KAgAD2AUfkDEYNDqCM9o2IQEjIJmHT0DLvxsijCw-ClIDsSjAkzeEebjEIYAuE5oEgADABJSKeSAOloGJSgsQh29433nVwQlDbnqfKA)
