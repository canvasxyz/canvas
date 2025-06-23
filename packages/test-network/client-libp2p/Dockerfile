FROM node:22-alpine

WORKDIR /app

COPY worker/dist/index.js index.mjs

RUN npm i -g puppeteer@24.10.0
RUN npm link puppeteer

ENTRYPOINT ["node"]
CMD ["index.mjs"]
