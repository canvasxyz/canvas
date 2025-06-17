FROM node:22-alpine

WORKDIR /app

COPY dist/peer/index.js lib/index.mjs

RUN npm i -g @canvas-js/okra-lmdb@0.2.4
RUN npm link @canvas-js/okra-lmdb

RUN npm i -g better-sqlite3@11.10.0
RUN npm link better-sqlite3

ENTRYPOINT ["node"]
CMD ["lib/index.mjs"]
