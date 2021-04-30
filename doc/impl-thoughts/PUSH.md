# Push Notifications
 - we setup the app on the sygnal server, with an app_id (io.element.hydrogen.web), generating a key pair
 - we create a web push subscription, passing the server pub key, and get `endpoint`, `p256dh` and `auth` back. We put `webpush_endpoint` and `auth` in the push data, and use `p256dh` as the push key?
 - we call `POST /_matrix/client/r0/pushers/set` on the homeserver with the sygnal instance url. We pass the web push subscription as pusher data.
 - the homeserver wants to send out a notification, calling sygnal on `POST /_matrix/push/v1/notify` with for each device the pusher data.
 - we encrypt and send with the data in the data for each device in the notification
 - this wakes up the service worker
 - now we need to find which local session id this notification is for

## Testing/development

 - set up local synapse
 - set up local sygnal
 - write pushkin
 - configure "hydrogen" app in sygnal config with a webpush pushkin
 - start writing service worker code in hydrogen (we'll need to enable it for local dev)
 - try to get a notification through

## Questions

    - do we use the `event_id_only` format?
    - for e2ee rooms, are we fine with just showing "Bob sent you a message (in room if not DM)", or do we want to sync and show the actual message? perhaps former can be MVP.
