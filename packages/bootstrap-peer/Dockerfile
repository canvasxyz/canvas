FROM node:20-buster

WORKDIR /app

COPY lib lib
COPY package.json package.json
RUN npm install --omit-dev

CMD ["npm", "run", "start"]
