FROM node:22-alpine

WORKDIR /app

COPY dist/index.js lib/index.mjs

RUN npm i -g better-sqlite3@11.10.0
RUN npm link better-sqlite3

ENTRYPOINT ["node"]
CMD ["lib/index.mjs"]
