FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache docker-cli

COPY package.json package-lock.json* ./
RUN npm install --production

COPY . .

EXPOSE 4000

CMD ["node", "src/index.js"]