#!/usr/bin/env bash
# shellcheck shell=bash

unlock_operation() {
  rm -f -- "$operation_lock/release-pid"
  rmdir -- "$operation_lock"
}

lock_operation() {
  local root=$1 kind=${2:-standalone} owner=''
  operation_lock="$root/.arsnova-prod-operation.lock"

  if [[ "$kind" == standalone && -f "$operation_lock/release-pid" ]] &&
    read -r owner <"$operation_lock/release-pid" && [[ "$owner" == "$PPID" ]]; then
    # Nur die direkten Kindprozesse des laufenden Release-Skripts teilen die Sperre.
    return 0
  fi

  if ! mkdir -- "$operation_lock"; then
    echo 'Ein Produktions-Deploy oder Topologiewechsel läuft bereits.' >&2
    return 1
  fi
  trap unlock_operation EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  if [[ "$kind" == release ]]; then
    printf '%s\n' "$$" >"$operation_lock/release-pid"
  fi
}
