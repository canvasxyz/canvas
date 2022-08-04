FROM node:16-alpine3.16 AS builder

WORKDIR /app

COPY package.json .
RUN npm install

COPY . .
RUN npm run build

FROM pierrezemb/gostatic

COPY --from=builder /app/dist /srv/http/
COPY --from=builder /app/public /srv/http/

ENTRYPOINT ["/goStatic", "-port", "8080"]
