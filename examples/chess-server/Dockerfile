FROM node:20-buster

WORKDIR /app
COPY package.json package.json
COPY contract.ts contract.ts
RUN npm install --omit-dev

CMD ["npm", "run", "start"]
