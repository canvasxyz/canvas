FROM node:22-alpine

WORKDIR /app

COPY dist/index.js lib/index.mjs

ENTRYPOINT ["node"]
CMD ["lib/index.mjs"]
