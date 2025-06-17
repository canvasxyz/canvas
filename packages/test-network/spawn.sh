#!/bin/bash

# Number of processes
PROCESS_COUNT="${1:-1}"

export DELAY=12

echo "starting $PROCESS_COUNT processes"

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
