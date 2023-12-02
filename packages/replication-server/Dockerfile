FROM node:20-buster

WORKDIR /app
COPY package.json package.json
COPY lib/ lib/
RUN npm install --omit-dev

CMD ["npm", "run", "start"]
