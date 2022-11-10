# Install dependencies only when needed
FROM node:16-alpine AS builder
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache bash git openssh libc6-compat
WORKDIR /app
COPY ./package.json .

# We should use `npm ci` but need to double-check that it's available on Fly
RUN npm install

COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

# Add `ARG` instructions below if you need `NEXT_PUBLIC_` variables
# then put the value on your fly.toml
# Example:
# ARG NEXT_PUBLIC_EXAMPLE="value here"

RUN npm run build

# Production image, copy all the files and run next
FROM node:16-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV CANVAS_HOME /data

RUN npm install -g @canvas-js/cli ipfs-only-hash

COPY --from=builder /app ./

RUN canvas install spec.canvas.js
CMD canvas run $(ipfs-only-hash spec.canvas.js --cidVersion 0) --unchecked
