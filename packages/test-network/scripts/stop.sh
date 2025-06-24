#!/bin/bash

for APP in canvas-testnet-dashboard canvas-testnet-rendezvous canvas-testnet-relay canvas-testnet-client-libp2p; do
    echo "stopping all ${APP} machines"
    fly machines list -a $APP --json | jq -r '.[] | .id' | while read MACHINE_ID; do
        fly machines stop -a $APP $MACHINE_ID
    done
done
