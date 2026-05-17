param(
	[int]$Port = 8443,
	[string]$ListenIp = "",
	[string]$WslIp = ""
)

$ErrorActionPreference = "Stop"

function Test-Admin {
	$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
	$principal = New-Object Security.Principal.WindowsPrincipal($identity)
	return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-PrivateLanIp {
	$ip = Get-NetIPConfiguration |
		Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq "Up" } |
		Where-Object { $_.InterfaceAlias -notmatch "vEthernet|WSL|Loopback|Docker|VirtualBox|VMware|Radmin|Hamachi|ZeroTier|Tailscale" } |
		Where-Object { $_.NetAdapter.InterfaceDescription -notmatch "Virtual|VPN|Radmin|Hamachi|ZeroTier|Tailscale|WireGuard|TAP|TUN" } |
		ForEach-Object { $_.IPv4Address.IPAddress } |
		Where-Object { $_ -match "^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)" } |
		Select-Object -First 1

	if (-not $ip) {
		throw "No private LAN IPv4 found. Pass -ListenIp explicitly, e.g. -ListenIp 192.168.2.196."
	}

	return $ip
}

function Get-WslIp {
	$ip = (wsl.exe -e sh -lc "hostname -I | awk '{print `$1}'").Trim()
	if (-not $ip) {
		throw "No WSL IPv4 found. Start WSL and Docker, then retry."
	}

	return $ip
}

if (-not (Test-Admin)) {
	throw "Run this script from an Administrator PowerShell, or use scripts/expose-lan.sh --admin from WSL."
}

if (-not $ListenIp) {
	$ListenIp = Get-PrivateLanIp
}

if (-not $WslIp) {
	$WslIp = Get-WslIp
}

Write-Host "Expose LAN port"
Write-Host "  Windows LAN IP: $ListenIp"
Write-Host "  WSL IP:         $WslIp"
Write-Host "  Port:           $Port"

netsh interface portproxy delete v4tov4 listenaddress=$ListenIp listenport=$Port | Out-Null
netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=$Port | Out-Null
netsh interface portproxy add v4tov4 listenaddress=$ListenIp listenport=$Port connectaddress=$WslIp connectport=$Port | Out-Null

$ruleName = "ft_transcendence $Port"
$existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existingRule) {
	Remove-NetFirewallRule -DisplayName $ruleName
}

New-NetFirewallRule `
	-DisplayName $ruleName `
	-Direction Inbound `
	-Action Allow `
	-Protocol TCP `
	-LocalAddress $ListenIp `
	-LocalPort $Port | Out-Null

Write-Host ""
Write-Host "Current portproxy rules:"
netsh interface portproxy show v4tov4

Write-Host ""
Write-Host "Testing Windows listener:"
Test-NetConnection $ListenIp -Port $Port

Write-Host ""
Write-Host "Open this URL from another device on the same Wi-Fi:"
Write-Host "https://${ListenIp}:${Port}"
