FROM node:20-buster

WORKDIR /app
COPY package.json package.json
COPY lib/ lib/
COPY dist/ dist/
COPY server.js server.js

RUN npm install --omit-dev

CMD ["npm", "run", "start"]
