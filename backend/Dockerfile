FROM node:22-bullseye
# RUN addgroup app && adduser -S -G app app
# USER app
WORKDIR /app
COPY package*.json ./
# USER root
# RUN chown -R app:app .
# USER app
RUN npm install
COPY . .
ENV PORT=3001
ENV UPLOADS_DIR=/app/uploads
RUN chmod +x /app/init_db.sh
CMD ["/bin/sh", "/app/init_db.sh"]
