FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json ./
RUN npm ci

# Copy application source
COPY . .
RUN npm run build

# Serve stage
FROM nginx:alpine
# Copy built files to Nginx web root
COPY --from=builder /app/dist /usr/share/nginx/html
# Expose port (Nginx default is 80)
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
