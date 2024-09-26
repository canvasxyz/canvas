#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: $0 <number-of-peers>"
  exit 1
fi

NUM_PEERS=$1

cp docker-compose.base.yml docker-compose.yml

for ((i=1; i<=NUM_PEERS; i++))
do
cat <<EOF >> docker-compose.yml

  peer-a$i:
    init: true
    build:
      context: .
      dockerfile: Dockerfile.peer
    depends_on:
      - bootstrap
    environment:
      - TOPIC=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
      - DEBUG=canvas:*,libp2p:gossipsub,libp2p:gossipsub:*
      - SERVICE_NAME=peer-a$i
      - LISTEN=/ip4/127.0.0.1/tcp/8080/ws
      - ANNOUNCE=/dns4/peer-a$i/tcp/8080/ws
      - BOOTSTRAP_LIST=/dns4/bootstrap/tcp/8080/ws/p2p/12D3KooWNbCWxWV3Tmu38pEi2hHVUiBHbr7x6bHLFQXRqgui6Vrn
EOF
done

# for ((i=1; i<=NUM_PEERS; i++))
# do
# cat <<EOF >> docker-compose.yml

#   peer-b$i:
#     init: true
#     build:
#       context: .
#       dockerfile: Dockerfile.peer
#     depends_on:
#       - bootstrap
#     environment:
#       - TOPIC=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
#       - DEBUG=canvas:*,libp2p:gossipsub,libp2p:gossipsub:*
#       - SERVICE_NAME=peer-b$i
#       - LISTEN=/ip4/127.0.0.1/tcp/8080/ws
#       - ANNOUNCE=/dns4/peer-b$i/tcp/8080/ws
#       - BOOTSTRAP_LIST=/dns4/bootstrap/tcp/8080/ws/p2p/12D3KooWNbCWxWV3Tmu38pEi2hHVUiBHbr7x6bHLFQXRqgui6Vrn
# EOF
# done

# for ((i=1; i<=NUM_PEERS; i++))
# do
# cat <<EOF >> docker-compose.yml

#   peer-c$i:
#     init: true
#     build:
#       context: .
#       dockerfile: Dockerfile.peer
#     depends_on:
#       - bootstrap
#     environment:
#       - TOPIC=cccccccccccccccccccccccccccccccc
#       - DEBUG=canvas:*,libp2p:gossipsub,libp2p:gossipsub:*
#       - SERVICE_NAME=peer-c$i
#       - LISTEN=/ip4/127.0.0.1/tcp/8080/ws
#       - ANNOUNCE=/dns4/peer-c$i/tcp/8080/ws
#       - BOOTSTRAP_LIST=/dns4/bootstrap/tcp/8080/ws/p2p/12D3KooWNbCWxWV3Tmu38pEi2hHVUiBHbr7x6bHLFQXRqgui6Vrn
# EOF
# done

# for ((i=1; i<=NUM_PEERS; i++))
# do
# cat <<EOF >> docker-compose.yml

#   peer-d$i:
#     init: true
#     build:
#       context: .
#       dockerfile: Dockerfile.peer
#     depends_on:
#       - bootstrap
#     environment:
#       - TOPIC=dddddddddddddddddddddddddddddddd
#       - DEBUG=canvas:*,libp2p:gossipsub,libp2p:gossipsub:*
#       - SERVICE_NAME=peer-d$i
#       - LISTEN=/ip4/127.0.0.1/tcp/8080/ws
#       - ANNOUNCE=/dns4/peer-d$i/tcp/8080/ws
#       - BOOTSTRAP_LIST=/dns4/bootstrap/tcp/8080/ws/p2p/12D3KooWNbCWxWV3Tmu38pEi2hHVUiBHbr7x6bHLFQXRqgui6Vrn
# EOF
# done

echo "docker-compose.yml file has been generated with $NUM_PEERS peer services."
