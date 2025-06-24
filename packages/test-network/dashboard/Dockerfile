FROM node:22-alpine

WORKDIR /app

COPY server/dist/index.js index.mjs
COPY client/dist          dist/

ENTRYPOINT ["node"]
CMD ["index.mjs"]
