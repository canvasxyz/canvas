FROM node:20-alpine

WORKDIR /app

COPY dist/peer/index.js lib/index.js

# COPY lib/peer/ lib/
# COPY package.json package.json
# RUN npm install --omit-dev

ENTRYPOINT ["node"]
CMD ["lib/index.js"]
