import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";

const ignoredInterfaceName =
	/^(docker|br-|veth|lo|tailscale|tun|tap|virbr|zt|wg|vEthernet|WSL|Loopback|VirtualBox|VMware|Radmin|Hamachi|ZeroTier)/i;
const unusableAddress = /^(127\.|169\.254\.)/;
const privateLanAddress = /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/;

function isPrivateLanAddress(ip) {
	return privateLanAddress.test(ip);
}

function isUsableLanAddress(ip) {
	return ip && !unusableAddress.test(ip) && isPrivateLanAddress(ip);
}

function isWsl() {
	try {
		return /microsoft|wsl/i.test(readFileSync("/proc/version", "utf8"));
	} catch {
		return false;
	}
}

function firstLocalInterfaceIp() {
	for (const [name, addresses] of Object.entries(networkInterfaces())) {
		if (ignoredInterfaceName.test(name)) {
			continue;
		}

		for (const address of addresses || []) {
			if (address.family === "IPv4" && !address.internal && isUsableLanAddress(address.address)) {
				return address.address;
			}
		}
	}

	return "";
}

function firstWindowsLanIp() {
	const command = [
		"$ErrorActionPreference = 'SilentlyContinue';",
		"Get-NetIPConfiguration",
		"| Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' }",
		"| Where-Object { $_.InterfaceAlias -notmatch 'vEthernet|WSL|Loopback|Docker|VirtualBox|VMware|Radmin|Hamachi|ZeroTier|Tailscale' }",
		"| Where-Object { $_.NetAdapter.InterfaceDescription -notmatch 'Virtual|VPN|Radmin|Hamachi|ZeroTier|Tailscale|WireGuard|TAP|TUN' }",
		"| ForEach-Object { $_.IPv4Address.IPAddress }",
		"| Where-Object { $_ -match '^(10\\.|192\\.168\\.|172\\.(1[6-9]|2[0-9]|3[0-1])\\.)' }",
		"| Select-Object -First 1",
	].join(" ");

	try {
		return execFileSync("powershell.exe", ["-NoProfile", "-Command", command], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		})
			.replace(/\r/g, "")
			.trim()
			.split("\n")[0]
			?.trim();
	} catch {
		return "";
	}
}

const overrideIp = process.env.LAN_IP?.trim();

if (overrideIp) {
	if (!isUsableLanAddress(overrideIp)) {
		console.error(`LAN_IP must be a private LAN IPv4 address, got '${overrideIp}'.`);
		process.exit(1);
	}

	console.log(overrideIp);
	process.exit(0);
}

const ip = isWsl() ? firstWindowsLanIp() : firstLocalInterfaceIp();

if (!ip) {
	const message = isWsl()
		? "No private Windows LAN IPv4 address found. Run 'ipconfig' in Windows and retry with LAN_IP=<Wi-Fi IPv4>, or use ngrok."
		: "No private LAN IPv4 address found. Make sure this machine is connected to Wi-Fi or Ethernet.";
	console.error(message);
	process.exit(1);
}

console.log(ip);
