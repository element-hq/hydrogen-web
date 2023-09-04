#!/bin/bash

# Make sure docker is available
if ! docker --version > /dev/null 2>&1; then
    echo "You need to intall docker before you can run the tests!"
    exit 1
fi

# Stop running containers
if docker stop hydrogen-synapse > /dev/null 2>&1; then
    echo "Existing 'hydrogen-synapse' container stopped ✔"
fi

if docker stop hydrogen-dex > /dev/null 2>&1; then
    echo "Existing 'hydrogen-dex' container stopped ✔"
fi

# Run playwright
yarn playwright test
