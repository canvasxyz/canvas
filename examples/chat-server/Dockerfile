FROM node:20-buster

WORKDIR /app
COPY package.json package.json
COPY contract.canvas.js contract.canvas.js
RUN pnpm install --omit-dev

CMD ["pnpm", "exec", "canvas", "run", "/data/app", "--init", "contract.canvas.js", "--metrics"]
