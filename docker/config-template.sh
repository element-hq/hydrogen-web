#!/bin/sh

set -eux

envsubst '$PUSH_APP_ID,$PUSH_GATEWAY_URL,$PUSH_APPLICATION_SERVER_KEY,$DEFAULT_HOMESERVER' \
    < /config.js.tmpl \
    > /tmp/config.js
