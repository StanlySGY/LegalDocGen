FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_API_BASE_URL=/api
ARG VITE_PRODUCT_MODE=personal_lawyer
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_PRODUCT_MODE=${VITE_PRODUCT_MODE}

COPY frontend/package*.json ./
RUN npm ci

COPY frontend ./
RUN npm run build

FROM nginx:1.27-alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
