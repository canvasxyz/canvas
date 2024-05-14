FROM node:20-alpine

WORKDIR /app

COPY dist/peer/index.js lib/index.mjs

# COPY lib/peer/ lib/
# COPY package.json package.json
# RUN npm install --omit-dev

RUN npm i -g @canvas-js/okra-node
RUN npm link @canvas-js/okra-node

ENTRYPOINT ["node"]
CMD ["lib/index.mjs"]
