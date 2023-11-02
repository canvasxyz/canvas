FROM node:20-buster

WORKDIR /app
COPY package.json package.json
COPY contract.canvas.js contract.canvas.js
RUN npm install --omit-dev

CMD ["npm", "run", "start"]

