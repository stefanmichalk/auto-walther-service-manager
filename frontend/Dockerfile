# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production Stage - Nginx für statische Files
FROM nginx:alpine

# Backend URL - Standard für docker-compose, überschreibbar für CapRover
ENV BACKEND_URL=http://backend:3222

# Nginx Template und Entrypoint kopieren
RUN mkdir -p /etc/nginx/templates
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["/docker-entrypoint.sh"]
