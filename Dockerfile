# Build frontend
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Final image
FROM python:3.11-slim
WORKDIR /app

# Install nginx
RUN apt-get update && apt-get install -y nginx && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend
COPY backend/ ./backend/
COPY start-docker.sh .

# Copy frontend build to nginx
COPY --from=frontend-build /app/frontend/dist /var/www/html
COPY nginx.conf /etc/nginx/sites-available/default

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 80
CMD ["./start-docker.sh"]
