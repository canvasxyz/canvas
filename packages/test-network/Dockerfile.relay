FROM node:22-alpine

WORKDIR /app

COPY dist/relay/index.js lib/index.mjs

ENTRYPOINT ["node"]
CMD ["lib/index.mjs"]
