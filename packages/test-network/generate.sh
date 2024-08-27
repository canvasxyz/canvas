#!/bin/bash

# Check if the user provided the number of servers as an argument
if [ -z "$1" ]; then
  echo "Usage: $0 <number-of-servers>"
  exit 1
fi

# Number of servers to create
NUM_SERVERS=$1

cp docker-compose.base.yml docker-compose.yml

# Loop to create the server services and append them to the docker-compose.yml file
for ((i=1; i<=NUM_SERVERS; i++))
do
cat <<EOF >> docker-compose.yml

  server-$i:
    init: true
    build:
      context: .
      dockerfile: Dockerfile.peer
    depends_on:
      - bootstrap
    environment:
      # - DEBUG=canvas:*
      - SERVICE_NAME=server-$i
      - LISTEN=/ip4/127.0.0.1/tcp/8080/ws
      - ANNOUNCE=/dns4/server-$i/tcp/8080/ws
      - BOOTSTRAP_LIST=/dns4/bootstrap/tcp/8080/ws/p2p/12D3KooWNbCWxWV3Tmu38pEi2hHVUiBHbr7x6bHLFQXRqgui6Vrn
EOF
done

echo "docker-compose.yml file has been generated with $NUM_SERVERS server services."
