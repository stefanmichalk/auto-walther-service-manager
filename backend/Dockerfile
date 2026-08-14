FROM node:20-alpine

# Build-Tools für native Module (better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Dependencies installieren
COPY package*.json ./
RUN npm ci --only=production && npm rebuild better-sqlite3

# App kopieren
COPY . .

# Uploads und DB Ordner erstellen
RUN mkdir -p uploads db

# Port exponieren
EXPOSE 3222

# Build-Datum speichern (Europe/Berlin)
RUN apk add --no-cache tzdata && TZ=Europe/Berlin date +"%d.%m.%Y %H:%M" > /app/BUILD_DATE && apk del tzdata

# Environment
ENV NODE_ENV=production

CMD ["node", "server.js"]
