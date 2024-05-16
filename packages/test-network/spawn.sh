#!/bin/bash

# Number of instances you want to run
count="${1:-1}"

echo "starting $count browser peers"

# Command to run (replace 'your_command_here' with your actual command)
command="node lib/peer-browser/entrypoint.js"

for i in $(seq 1 $count)
do
    # Start the command and prefix its output
    (MIN_CONNECTIONS=1 SERVICE_NAME=browser-$i BOOTSTRAP_LIST=/dns4/localhost/tcp/8080/ws/p2p/12D3KooWNbCWxWV3Tmu38pEi2hHVUiBHbr7x6bHLFQXRqgui6Vrn $command) | sed "s/^/[browser-$i] /" &
done

# Wait for all background processes to finish
wait
echo "All instances completed."
