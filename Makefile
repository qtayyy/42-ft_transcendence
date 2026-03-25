all: build start

LAN_IP_CMD = sh -c '\
	if [ "$$(uname -s)" = "Darwin" ]; then \
		for iface in en0 en1; do \
			ip="$$(ipconfig getifaddr $$iface 2>/dev/null || true)"; \
			if [ -n "$$ip" ]; then \
				echo "$$ip"; \
				exit 0; \
			fi; \
		done; \
	elif [ "$$(uname -s)" = "Linux" ]; then \
		ip="$$(ip -4 -o addr show up primary scope global 2>/dev/null | awk '\''$$2 !~ /^(docker|br-|veth|lo|tailscale|tun|tap|virbr|zt|wg)/ {split($$4, a, "/"); print a[1]; exit}'\'')"; \
		if [ -z "$$ip" ]; then \
			ip="$$(hostname -I 2>/dev/null | awk '\''{for (i = 1; i <= NF; i++) if ($$i !~ /^(127\.|172\.17\.|172\.18\.|172\.19\.|172\.2[0-9]\.|172\.3[0-1]\.|192\.168\.122\.)/) {print $$i; exit}}'\'')"; \
		fi; \
		if [ -n "$$ip" ]; then \
			echo "$$ip"; \
			exit 0; \
		fi; \
	fi; \
	exit 1'

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

lan-ip:
	@LAN_IP="$$( $(LAN_IP_CMD) )"; \
	if [ -z "$$LAN_IP" ]; then \
		echo "No LAN IPv4 address found."; \
		echo "Make sure this machine is connected to Wi-Fi or Ethernet, then try again."; \
		exit 1; \
	fi; \
	node ./scripts/public-app-url.mjs set "https://$$LAN_IP:8443"; \
	echo "$$LAN_IP"

lan-url:
	@LAN_IP="$$( $(LAN_IP_CMD) )"; \
	if [ -z "$$LAN_IP" ]; then \
		echo "No LAN IPv4 address found."; \
		echo "Make sure this machine is connected to Wi-Fi or Ethernet, then try again."; \
		exit 1; \
	fi; \
	node ./scripts/public-app-url.mjs set "https://$$LAN_IP:8443"; \
	echo "Host machine LAN IP: $$LAN_IP"; \
	echo "Open this on the host machine:   https://localhost:8443"; \
	echo "Open this on another LAN device: https://$$LAN_IP:8443"; \
	echo "Updated backend/.env PUBLIC_APP_URL to https://$$LAN_IP:8443"; \
	echo "If the other device cannot connect, check the host firewall and accept the browser HTTPS warning once."

lan-help:
	@echo "LAN checklist"; \
	echo "  1. Start the stack: make start"; \
	echo "  2. Print the shareable link: make lan-url"; \
	echo "  3. Open the printed URL on another device on the same Wi-Fi."; \
	echo ""; \
	echo "Host firewall help"; \
	echo "  macOS"; \
	echo "    Check firewall state:"; \
	echo "      sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate"; \
	echo "    If devices still cannot connect, allow incoming connections for Docker/Desktop/terminal"; \
	echo "    in System Settings -> Network -> Firewall."; \
	echo ""; \
	echo "  Ubuntu with ufw"; \
	echo "      sudo ufw allow 8443/tcp"; \
	echo "      sudo ufw status"; \
	echo ""; \
	echo "  Ubuntu without ufw"; \
	echo "      sudo systemctl status firewalld"; \
	echo "      sudo iptables -S"; \
	echo "      sudo nft list ruleset"; \
	echo ""; \
	echo "  Windows host"; \
	echo "      New-NetFirewallRule -DisplayName \"LAN 8443\" -Direction Inbound -Protocol TCP -LocalPort 8443 -Action Allow"; \
	echo ""; \
	echo "If the host machine can open the LAN URL but another device still cannot,"; \
	echo "the Wi-Fi may be using client isolation. Try the same phone hotspot instead."

# Short-term public access via ngrok. Start the local stack first, then run:
#   make ngrok
# The target updates backend/.env automatically and restarts the backend so
# OAuth redirects use the current tunnel URL.
ngrok:
	@command -v ngrok >/dev/null 2>&1 || (echo "ngrok is not installed. Install it first, then run 'ngrok config add-authtoken <token>'."; exit 1)
	@TMP_LOG="$$(mktemp -t ft_transcendence_ngrok.XXXXXX)"; \
	cleanup() { \
		if [ -n "$$NGROK_PID" ] && kill -0 "$$NGROK_PID" 2>/dev/null; then \
			kill "$$NGROK_PID" 2>/dev/null || true; \
			wait "$$NGROK_PID" 2>/dev/null || true; \
		fi; \
		rm -f "$$TMP_LOG"; \
	}; \
	trap cleanup EXIT INT TERM; \
	ngrok http https://localhost:8443 --upstream-tls-verify=false >"$$TMP_LOG" 2>&1 & \
	NGROK_PID=$$!; \
	node ./scripts/public-app-url.mjs ngrok "$(GOOGLE_CONSOLE_URL)" 20 1000; \
	docker compose -f ./compose.yaml up -d --force-recreate backend; \
	echo "ngrok is running. Press Ctrl+C to stop it."; \
	wait "$$NGROK_PID"

# make ngrok-sync GOOGLE_CONSOLE_URL='https://console.cloud.google.com/auth/clients/XXXXX'
ngrok-sync:
	@node ./scripts/sync-ngrok-url.mjs "$(GOOGLE_CONSOLE_URL)"
	@docker compose -f ./compose.yaml up -d --force-recreate backend

ngrok-restart-backend:
	@docker compose -f ./compose.yaml up -d --force-recreate backend

.PHONY: all build start dev stop down logs clean prune re lan-ip lan-url lan-help ngrok ngrok-sync ngrok-restart-backend
