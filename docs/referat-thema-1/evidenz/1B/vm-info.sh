#!/usr/bin/env bash
# 1B: Beschreibung einer Labor-VM von innen als JSON (Kernel, Betriebssystem, CPUs, RAM, Docker, Virtualisierung).
# Wird von umgebung.sh (Linux) und labor.ps1 (Windows) per SSH in beiden VMs aufgerufen; ohne Tokens.
set -uo pipefail
os="$(. /etc/os-release 2>/dev/null && echo "${PRETTY_NAME:-unbekannt}")"
cpu="$(awk -F': ' '/^model name/ {print $2; exit}' /proc/cpuinfo)"
ram="$(awk '/^MemTotal:/ {printf "%.1f", $2 / 1048576}' /proc/meminfo)"
docker="$(docker version --format '{{.Server.Version}}' 2>/dev/null || true)"
virt="$(systemd-detect-virt 2>/dev/null || true)"
jq -n --arg kernel "$(uname -r)" --arg os "$os" --arg cpu "$cpu" --argjson cpus "$(nproc)" --argjson ram "$ram" \
  --arg docker "$docker" --arg virt "$virt" --arg host "$(hostname)" \
  '{host: $host, kernel: $kernel, os: $os, cpuModell: $cpu, cpus: $cpus, ramGib: $ram,
    docker: (if $docker == "" then null else $docker end), virtualisierung: (if $virt == "" then null else $virt end)}'
