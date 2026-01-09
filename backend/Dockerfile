FROM node:20-alpine

WORKDIR /app

# Dependencies installieren
COPY package*.json ./
RUN npm ci --only=production

# App kopieren
COPY . .

# Uploads und DB Ordner erstellen
RUN mkdir -p uploads db

# Port exponieren
EXPOSE 3222

# Environment
ENV NODE_ENV=production

CMD ["node", "server.js"]
