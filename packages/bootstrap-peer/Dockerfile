FROM node:20-alpine

WORKDIR /app

COPY lib lib
COPY package.json package.json
RUN npm install --omit-dev

CMD ["npm", "run", "start"]
