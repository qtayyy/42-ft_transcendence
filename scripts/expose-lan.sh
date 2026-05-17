#!/usr/bin/env sh
set -eu

PORT="${PORT:-8443}"
LAN_IP="${LAN_IP:-}"
ADMIN=0

for arg in "$@"; do
	case "$arg" in
		--admin)
			ADMIN=1
			;;
		--help|-h)
			cat <<'EOF'
Usage:
  scripts/expose-lan.sh [--admin]

Environment:
  LAN_IP=192.168.2.196  LAN IPv4 to expose
  PORT=8443             Port to expose

Examples:
  scripts/expose-lan.sh --admin
  LAN_IP=192.168.2.196 scripts/expose-lan.sh --admin
EOF
			exit 0
			;;
		*)
			echo "Unknown argument: $arg" >&2
			exit 1
			;;
	esac
done

if [ -z "$LAN_IP" ]; then
	LAN_IP="$(node ./scripts/lan-ip.mjs)"
fi

if command -v powershell.exe >/dev/null 2>&1 && grep -qiE "microsoft|wsl" /proc/version 2>/dev/null; then
	SCRIPT_PATH="$(wslpath -w "$(pwd)/scripts/expose-lan.ps1")"

	if [ "$ADMIN" -eq 1 ]; then
		powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "\
			Start-Process PowerShell \
				-Verb RunAs \
				-ArgumentList '-NoProfile -ExecutionPolicy Bypass -NoExit -File \"$SCRIPT_PATH\" -ListenIp \"$LAN_IP\" -Port $PORT'"
		echo "Started an Administrator PowerShell window to expose https://$LAN_IP:$PORT"
	else
		powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$SCRIPT_PATH" -ListenIp "$LAN_IP" -Port "$PORT"
	fi

	exit 0
fi

case "$(uname -s)" in
	Linux)
		echo "Native Linux detected."
		echo "Docker Compose already publishes 0.0.0.0:$PORT -> nginx:443."
		if command -v ufw >/dev/null 2>&1; then
			echo "Allowing TCP $PORT through ufw. You may be prompted for sudo."
			sudo ufw allow "$PORT/tcp"
			sudo ufw status
		else
			echo "ufw not found. If a firewall is enabled, allow inbound TCP $PORT manually."
			echo "Useful checks:"
			echo "  sudo systemctl status firewalld"
			echo "  sudo iptables -S"
			echo "  sudo nft list ruleset"
		fi
		;;
	Darwin)
		echo "macOS detected."
		echo "Docker Desktop should publish https://$LAN_IP:$PORT directly."
		echo "If another device cannot connect, allow Docker/Desktop/terminal incoming connections in:"
		echo "  System Settings -> Network -> Firewall"
		echo "Firewall state:"
		sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate || true
		;;
	*)
		echo "Unsupported OS: $(uname -s)" >&2
		exit 1
		;;
esac

echo ""
echo "Open this URL from another device on the same Wi-Fi:"
echo "https://$LAN_IP:$PORT"
