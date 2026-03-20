FROM node:22-bullseye
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN chmod +x /app/init_db.sh
CMD ["/bin/sh", "/app/init_db.sh"]
