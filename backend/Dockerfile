FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 4050

CMD ["sh", "-c", "node src/db/migrate.js && node src/db/seed.js && node src/index.js"]
