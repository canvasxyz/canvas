#!/bin/bash

# Number of processes
PROCESS_COUNT="${1:-1}"

# Peers per process
export PEER_COUNT="${2:-10}"
export DELAY=12

echo "starting $PROCESS_COUNT processes of $PEER_COUNT peers"

command="node client-libp2p/worker/lib/index.js"

for i in $(seq 1 $PROCESS_COUNT)
do
    # Start the command and prefix its output
    $command | sed "s/^/[browser-$i] /" &
done

# Wait for all background processes to finish
wait
echo "All instances completed."
