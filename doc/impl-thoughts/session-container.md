what should this new container be called?
 - Client
 - SessionContainer


it is what is returned from bootstrapping a ... thing
it allows you to replace classes within the client through IoC?
it wires up the different components
it unwires the components when you're done with the thing
it could hold all the dependencies for setting up a client, even before login
    - online detection api
    - clock
    - homeserver
    - requestFn

we'll be explicitly making its parts public though, like session, sync, reconnector

merge the connectionstate and 
