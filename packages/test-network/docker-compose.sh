#!/bin/bash

test -f .env && source .env

echo "NUM_TOPICS: ${NUM_TOPICS:=1}"
echo "NUM_PEERS:  ${NUM_PEERS:=8}"
echo "DELAY:      ${DELAY:=10}"
echo "INTERVAL:   ${INTERVAL:=$DELAY}"
echo "DEBUG:      ${DEBUG:="canvas:*"}"

ALPHABET=abcdefghijklmnopqrstuvwxyz

cp docker-compose.base.yml docker-compose.yml

for t in $(seq 0 $((NUM_TOPICS-1))); do
    TOPIC="test-network-${ALPHABET:$t:1}"
    for ((i=1; i<=NUM_PEERS; i++))
    do
        NAME="${TOPIC}-${i}"
        cat <<EOF >> docker-compose.yml

  ${NAME}:
    init: true
    build:
      context: .
      dockerfile: Dockerfile.peer
    depends_on:
      - bootstrap
    environment:
      - DELAY=10
      - INTERVAL=${INTERVAL}
      - TOPIC=${TOPIC}
      - DEBUG=${DEBUG}
      - LISTEN=/ip4/0.0.0.0/tcp/8080/ws
      - ANNOUNCE=/dns4/${NAME}/tcp/8080/ws
      - BOOTSTRAP_LIST=/dns4/bootstrap/tcp/8080/ws/p2p/12D3KooWMvSCSeJ6zxJJRQZSpyGqbNcqSJfcJGZLRiMVMePXzMax
EOF
    done
done

echo "docker-compose.yml file has been generated with ${NUM_TOPICS} topics of ${NUM_PEERS} peers."
