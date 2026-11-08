FROM docker.io/library/node:20-alpine AS build

WORKDIR /app

ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY package*.json ./
RUN npm install

COPY . ./
RUN npm run build

FROM docker.io/library/nginx:alpine AS production

RUN apk add --no-cache curl

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 8065

HEALTHCHECK CMD curl --fail http://localhost:8065/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
