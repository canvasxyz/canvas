FROM node:22-alpine

WORKDIR /app

COPY server/dist/index.js index.mjs
COPY client/dist          dist/
COPY dist/client-libp2p   dist/client-libp2p

ENTRYPOINT ["node"]
CMD ["index.mjs"]
