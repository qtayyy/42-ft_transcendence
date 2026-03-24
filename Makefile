all: build start

build:
	@docker compose -f ./compose.yaml build

start:
	@docker compose -f ./compose.yaml up -d

dev: build
	@docker compose -f ./compose.yaml watch

stop:
	@docker compose -f ./compose.yaml stop

down:
	@docker compose -f ./compose.yaml down

logs:
	@docker compose -f ./compose.yaml logs -f

clean:
	@echo ""; \
	echo "⚠️  WARNING: This will permanently delete ALL Docker data on your device!"; \
	echo "   This includes ALL containers, images, volumes, and networks."; \
	echo ""; \
	read -p "   Are you sure you want to continue? [y/N]: " confirm; \
	echo ""; \
	if [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ]; then \
		echo "🗑️  Cleaning all Docker data..."; \
		docker stop $$(docker ps -qa) 2>/dev/null; \
		docker rm $$(docker ps -qa) 2>/dev/null; \
		docker rmi -f $$(docker images -qa) 2>/dev/null; \
		docker volume rm $$(docker volume ls -q) 2>/dev/null; \
		docker network rm $$(docker network ls -q) 2>/dev/null; \
		echo "✅  Done."; \
	else \
		echo "❌  Aborted. No changes were made."; \
	fi

prune:
	@docker system prune -af --volumes

re: stop down all

# Short-term public access via ngrok. Start the local stack first, then run:
#   make ngrok
# Copy the printed https://*.ngrok.app URL into backend/.env as PUBLIC_APP_URL,
# then restart the backend so OAuth redirects use the current tunnel URL.
ngrok:
	@command -v ngrok >/dev/null 2>&1 || (echo "ngrok is not installed. Install it first, then run 'ngrok config add-authtoken <token>'."; exit 1)
	@ngrok http https://localhost:8443 --upstream-tls-verify=false

# make ngrok-sync GOOGLE_CONSOLE_URL='https://console.cloud.google.com/auth/clients/XXXXX'
ngrok-sync:
	@node ./scripts/sync-ngrok-url.mjs "$(GOOGLE_CONSOLE_URL)"
	@docker compose -f ./compose.yaml up -d --force-recreate backend

ngrok-restart-backend:
	@docker compose -f ./compose.yaml up -d --force-recreate backend

.PHONY: all build start dev stop down logs clean prune re ngrok ngrok-sync ngrok-restart-backend
