# Production image for ansible-lab: build the static SPA, then serve it with nginx.
# (Dev/hot-reload lives in Dockerfile.dev — this file is for published images.)

# --- build stage: produce the static bundle ---
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build          # emits /app/dist

# --- runtime stage: serve static files with nginx ---
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
# nginx:alpine already runs nginx in the foreground by default
