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
	if ! SCRIPT_PATH="$(wslpath -w "$(pwd)/scripts/expose-lan.ps1" 2>/dev/null)"; then
		echo "WSL detected, but wslpath is not available. Cannot configure Windows port forwarding." >&2
		exit 1
	fi

	if [ "$ADMIN" -eq 1 ]; then
		if ! powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "\
			Start-Process PowerShell \
				-Verb RunAs \
				-ArgumentList '-NoProfile -ExecutionPolicy Bypass -NoExit -File \"$SCRIPT_PATH\" -ListenIp \"$LAN_IP\" -Port $PORT'" 2>/dev/null; then
			echo "WSL detected, but Windows PowerShell could not be started." >&2
			echo "Run from Windows PowerShell as Administrator instead:" >&2
			printf '  .\\scripts\\expose-lan.ps1 -ListenIp %s -Port %s\n' "$LAN_IP" "$PORT" >&2
			exit 1
		fi
		echo "Started an Administrator PowerShell window to expose https://$LAN_IP:$PORT"
	else
		if ! powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$SCRIPT_PATH" -ListenIp "$LAN_IP" -Port "$PORT" 2>/dev/null; then
			echo "WSL detected, but Windows PowerShell could not configure port forwarding." >&2
			echo "Try running from Windows PowerShell as Administrator:" >&2
			printf '  .\\scripts\\expose-lan.ps1 -ListenIp %s -Port %s\n' "$LAN_IP" "$PORT" >&2
			exit 1
		fi
	fi

	exit 0
fi

case "$(uname -s)" in
	Linux)
		echo "Native Linux detected."
		echo "Docker Compose already publishes 0.0.0.0:$PORT -> nginx:443."
		if command -v ufw >/dev/null 2>&1; then
			if [ "$(id -u)" -eq 0 ]; then
				echo "Allowing TCP $PORT through ufw."
				ufw allow "$PORT/tcp"
				ufw status
			elif command -v sudo >/dev/null 2>&1; then
				echo "Checking whether sudo can update ufw without prompting."
				if sudo -n true 2>/dev/null; then
					sudo ufw allow "$PORT/tcp"
					sudo ufw status
				else
					echo "sudo is not available without a password, so no firewall changes were made."
					echo "If this is a campus machine, ask staff to allow inbound TCP $PORT or use ngrok."
				fi
			else
				echo "ufw is installed, but sudo is not available. No firewall changes were made."
				echo "If this is a campus machine, ask staff to allow inbound TCP $PORT or use ngrok."
			fi
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
		if [ -x /usr/libexec/ApplicationFirewall/socketfilterfw ]; then
			/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null || true
		fi
		;;
	*)
		echo "Unsupported OS: $(uname -s)" >&2
		exit 1
		;;
esac

echo ""
echo "Open this URL from another device on the same Wi-Fi:"
echo "https://$LAN_IP:$PORT"
