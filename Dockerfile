FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DB_PATH=/data/autogest.db
COPY package.json ./
COPY backend/src ./backend/src
COPY frontend ./frontend
COPY scripts/admin.cjs scripts/backup.cjs ./scripts/
RUN mkdir -p /data /app/backend/backups && chown -R node:node /data /app/backend/backups
USER node
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "backend/src/server.js"]
