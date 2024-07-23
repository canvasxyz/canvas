#!/bin/bash

# Number of instances you want to run
count="${1:-1}"

echo "starting $count browser peers"

# Command to run (replace 'your_command_here' with your actual command)
command="node lib/peer-browser/entrypoint.js"

export BOOTSTRAP_LIST="/dns4/localhost/tcp/8080/ws/p2p/12D3KooWNbCWxWV3Tmu38pEi2hHVUiBHbr7x6bHLFQXRqgui6Vrn"
# export RELAY_SERVER="/dns4/localhost/tcp/8081/ws/p2p/12D3KooWEaSQnJTxztTHmKmcQkDy3oScjo8ww4JCKig73XH4cmb3"
# export RELAY_SERVER="/dns4/canvas-relay-server-thrumming-surf-3764.fly.dev/tcp/443/wss/p2p/12D3KooWFfrssaGYVeMQxzQoSPcr7go8uHe2grkSkr3b99Ky1M7R"

for i in $(seq 1 $count)
do
    # Start the command and prefix its output
    (SERVICE_NAME=browser-$i $command) | sed "s/^/[browser-$i] /" &
done

# Wait for all background processes to finish
wait
echo "All instances completed."
