FROM node:20-alpine

WORKDIR /app
COPY package.json package.json
COPY lib/ lib/
RUN npm install --omit-dev

CMD ["node", "lib/index.js"]
