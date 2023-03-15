#!/bin/sh

set -eux

if [ -n "${CONFIG_OVERRIDE:-}" ]; then
    # Use config override environment variable if set
    echo "$CONFIG_OVERRIDE" > /tmp/config.json
else
    # Otherwise, use the default config that was bundled in the image
    cp /config.json.bundled /tmp/config.json
fi
