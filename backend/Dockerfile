FROM node:20-alpine AS base
WORKDIR /app

ARG CACHEBUST=1

RUN apk add --no-cache iputils

COPY package.json ./
RUN npm install --production

COPY . .

EXPOSE 3001
CMD ["node", "src/app.js"]
