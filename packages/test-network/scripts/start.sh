#!/bin/bash

for APP in canvas-testnet-dashboard canvas-testnet-rendezvous canvas-testnet-relay canvas-testnet-client-libp2p; do
    echo "starting all ${APP} machines"
    fly machines list -a $APP --json | jq -r '.[] | .id' | while read MACHINE_ID; do
        fly machines start -a $APP $MACHINE_ID
    done
done
