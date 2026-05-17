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
RUN apt-get update && apt-get upgrade -y && \
	apt-get install -y openssl && rm -rf /var/lib/apt/lists/* && \
	mkdir -p /app/certs && \
	openssl req -newkey rsa:4096 -x509 -sha256 -days 365 -nodes \
		-out /app/certs/server.crt \
		-keyout /app/certs/server.key \
		-subj "/C=MY/ST=SELANGOR/L=PETALINGJAYA/O=42KL/OU=qtay/CN=backend/"
ENV DATABASE_URL="file:/data/dev.db"
RUN chmod +x /app/init_db.sh
CMD ["/bin/sh", "/app/init_db.sh"]
