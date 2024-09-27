#!/bin/bash

# Number of processes
PROCESS_COUNT="${1:-1}"

# Peers per process
export PEER_COUNT="${2:-10}"
export DELAY=1

echo "starting $PROCESS_COUNT processes of $PEER_COUNT peers"

# Command to run (replace 'your_command_here' with your actual command)
command="node lib/client/entrypoint.js"

for i in $(seq 1 $PROCESS_COUNT)
do
    # Start the command and prefix its output
    (SERVICE_NAME=browser-$i $command) | sed "s/^/[browser-$i] /" &
done

# Wait for all background processes to finish
wait
echo "All instances completed."
