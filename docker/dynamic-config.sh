#!/bin/sh

set -eux

# Use config override environment variable if set
if [ -n "${CONFIG_OVERRIDE:-}" ]; then
    echo "$CONFIG_OVERRIDE" > /usr/share/nginx/html/config.json
fi
