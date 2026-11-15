#!/usr/bin/env bash
# .env von stdin → stdout ohne Secrets (Reproduktionspaket, Dossier 10.6): Werte von Schlüsseln mit TOKEN,
# SECRET, PASSWORD/PASS, KEY, SALT, PEPPER, CREDENTIAL, PRIVATE sowie URLs/DSNs mit Zugangsdaten (user:pw@)
# werden durch sha256:<hex> des Werts ersetzt (ohne umschließende Anführungszeichen). Alles andere bleibt.
set -euo pipefail
while IFS= read -r zeile || [[ -n "$zeile" ]]; do
  if [[ "$zeile" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
    k="${BASH_REMATCH[1]}" v="${BASH_REMATCH[2]}"
    [[ "$v" =~ ^\"(.*)\"$ || "$v" =~ ^\'(.*)\'$ ]] && v="${BASH_REMATCH[1]}"
    geheim=0
    [[ "${k^^}" =~ (TOKEN|SECRET|PASSWORD|PASS|KEY|SALT|PEPPER|CREDENTIAL|PRIVATE|DSN) ]] && geheim=1
    [[ "$v" =~ ://[^/@]*:[^/@]*@ ]] && geheim=1
    if ((geheim)) && [[ -n "$v" ]]; then
      printf '%s=sha256:%s\n' "$k" "$(printf '%s' "$v" | sha256sum | cut -d' ' -f1)"
    else
      printf '%s=%s\n' "$k" "$v"
    fi
  else
    printf '%s\n' "$zeile"
  fi
done
