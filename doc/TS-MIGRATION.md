# Typescript migration
 
## Introduce `abstract` & `override`

 - find all methods and getters that throw or are empty in base classes and turn into abstract method or if all methods are abstract, into an interface.
 - change child impls to not call super.method and to add override
 - don't allow implicit override in ts config
