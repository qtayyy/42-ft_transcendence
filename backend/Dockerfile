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
RUN chmod +x /app/init_db.sh
CMD ["/bin/sh", "/app/init_db.sh"]
