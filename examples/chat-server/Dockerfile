FROM node:20-buster

WORKDIR /app
COPY package.json package.json
COPY contract.canvas.js contract.canvas.js
RUN npm install --omit-dev

CMD ["npx", "canvas", "run", "/data/app", "--disableHistoryIndexing", "--topic", "chat-example.canvas.xyz", "--port", "8080", "--init", "contract.canvas.js", "--metrics"]
