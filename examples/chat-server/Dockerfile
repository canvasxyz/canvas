FROM node:20-buster

WORKDIR /app
COPY package.json package.json
COPY contract.canvas.js contract.canvas.js
RUN npm install --omit-dev

CMD ["npx", "canvas", "run", "/data/app", "--port", "8081", "--init", "contract.canvas.js", "--metrics"]
