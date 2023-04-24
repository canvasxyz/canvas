# Install dependencies only when needed
FROM node:18-alpine AS builder
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache bash git openssh libc6-compat
WORKDIR /app
COPY ./package.json .

# We can't use `npm ci` because it requires a package-lock.json file,
# which we don't have because we're hoisting everything via workspaces
RUN npm install

COPY . .

RUN npm run build

# Production image, copy all the files and run next
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV CANVAS_HOME /data

COPY --from=builder /app ./

CMD [ "npm", "run", "start", "--", "--verbose", "--listen", "/ip4/0.0.0.0/tcp/8080/ws", "--announce", "/dns4/canvas-chat-3.fly.dev/tcp/4001/wss" ]
