FROM node:20-alpine

WORKDIR /app
COPY package.json package.json
COPY lib/peer/ lib/
RUN npm install --omit-dev

ENTRYPOINT ["node"]
CMD ["lib/index.js"]
