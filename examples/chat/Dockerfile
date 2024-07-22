FROM node:20-buster

WORKDIR /app
COPY package.json package.json
COPY server/contract.canvas.js contract.canvas.js
RUN npm install --omit-dev

CMD ["npx", "canvas", "run", "/data/app", "--topic", "chat-example.canvas.xyz", "--port", "8080", "--init", "server/contract.canvas.js", "--metrics"]
