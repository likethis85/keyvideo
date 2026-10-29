FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node . .
RUN mkdir -p /app/data && chown -R node:node /app/data

USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health >/dev/null || exit 1

CMD ["node", "server.js"]
