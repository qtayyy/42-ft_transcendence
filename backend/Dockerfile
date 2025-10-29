FROM node:22-slim
# RUN addgroup app && adduser -S -G app app
# USER app
WORKDIR /app
COPY package*.json ./
# USER root
# RUN chown -R app:app .
# USER app
RUN npm install
COPY . .
ENV DATABASE_URL="file:/data/dev.db"
CMD npx prisma migrate dev --name init && npm run seed && npm run dev
