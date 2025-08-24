## Builder
FROM node:20.12.2-alpine3.18 AS builder

WORKDIR /app

COPY package*.json /app/
RUN apk add --no-cache python3 make g++ 
RUN npm ci
COPY . /app/
RUN npm run build

FROM node:20.12.2-alpine3.18 AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S app && adduser -S app -G app || true

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/config ./config
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

RUN apk add --no-cache python3 make g++
RUN npm ci --omit=dev

RUN mkdir -p /app/data && chown -R app:app /app/data
VOLUME ["/app/data"]

USER app

EXPOSE 3000

CMD ["node", "dist/index.js"]
