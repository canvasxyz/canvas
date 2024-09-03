FROM node:22-alpine

WORKDIR /app
COPY contract.canvas.js contract.canvas.js
RUN npm i @canvas-js/cli@latest

CMD ["npx", "canvas", "run", "/data/app", "--topic", "chat-example.canvas.xyz", "--port", "8000", "--init", "contract.canvas.js", "--metrics"]
