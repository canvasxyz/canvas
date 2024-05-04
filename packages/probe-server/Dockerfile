FROM node:20-buster

WORKDIR /app
COPY package.json package.json
COPY lib/ lib/
COPY dist/ dist/

RUN npm install --omit-dev

CMD ["npm", "run", "start"]
