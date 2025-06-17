#!/bin/bash

# Kill background processes when finished
trap 'kill 0' INT

./docker-compose.sh

# Run the docker-compose network in the background
docker compose rm -f && docker compose up --build --remove-orphans &

# Number of processes
PROCESS_COUNT="${1:-1}"

# Peers per process
export PEER_COUNT="${2:-10}"
export DELAY=12

echo "starting $PROCESS_COUNT processes of $PEER_COUNT peers"

# command="node lib/client-ws/entrypoint.js"
command="node lib/client-webrtc/entrypoint.js"

for i in $(seq 1 $PROCESS_COUNT)
do
    # Start the command and prefix its output
    $command | sed "s/^/[browser-$i] /" &
done

# Wait for all background processes to finish
wait
echo "All instances completed."
