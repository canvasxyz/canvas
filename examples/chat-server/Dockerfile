FROM node:20-buster

WORKDIR /app
COPY package.json package.json
COPY contract.canvas.js contract.canvas.js
RUN npm install --omit-dev

CMD ["canvas", "run", "/data/app", "--init", "contract.canvas.js", "--verbose", "--metrics", "--listen", "/ip6/::/tcp/8080/ws", "--announce", "/dns4/canvas-chat.fly.dev/tcp/443/wss"]

