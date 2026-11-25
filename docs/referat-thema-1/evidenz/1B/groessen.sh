# shellcheck shell=bash
# Größenregel für die 1B-Labor-VMs (ADR 1B-010), zum Einbinden per `source`.
# Testfälle: groessen-faelle.json; Tests: groessen.test.mjs. Gleiche Regel in groessen.ps1.

# groessen_empfehlung KERNE THREADS RAM_GIB [KERN_JE_CPU_CSV]
# Gibt JSON aus: {"abbruch":…,"llm":{vcpu,ramGib,diskGib,cpuset},"app":{…},"warnungen":[…]}.
# Platte: Obergrenze der dünn belegten Disk; der App-Build braucht kurz ~18 GiB (gemessen 2026-11-13).
# KERN_JE_CPU_CSV: Kern-ID je logischer CPU, Index = CPU-Nummer (lscpu -p=CPU,CORE,SOCKET).
GROESSEN_LLM_DISK=20 GROESSEN_APP_DISK=25

groessen_empfehlung() {
  local kerne=$1 threads=$2 ram=$3 topo=${4:-}
  local llm_ram app_ram llm_cpu app_cpu=2 smt=0
  local -a warn=()
  ((threads > kerne)) && smt=1

  if ((ram - 4 >= 18)); then
    llm_ram=12 app_ram=6
  elif ((ram - 4 >= 16)); then
    llm_ram=12 app_ram=4
  elif ((ram - 4 >= 14)); then
    llm_ram=10 app_ram=4
  elif ((ram - 2 >= 14)); then
    llm_ram=10 app_ram=4
  else
    printf '{"abbruch":"ram-zu-klein"}\n'
    return 0
  fi

  if ((smt)); then llm_cpu=$kerne; else llm_cpu=$((kerne - 2)); fi
  ((llm_cpu > 8)) && llm_cpu=8
  if ((llm_cpu < 2)); then
    printf '{"abbruch":"kerne-zu-wenig"}\n'
    return 0
  fi

  ((llm_cpu < 4)) && warn+=(llm-unter-4)
  ((app_ram < 6)) && warn+=(app-ram-4)
  ((llm_ram < 12)) && warn+=(llm-ram-10)
  ((ram - llm_ram - app_ram < 4)) && warn+=(host-ram-2)

  local llm_set=null app_set=null sets
  if [[ -n "$topo" ]]; then
    sets="$(groessen_pinning "$llm_cpu" "$app_cpu" "$topo")"
    llm_set="\"${sets% *}\"" app_set="\"${sets#* }\""
  fi

  local w=""
  ((${#warn[@]})) && w="$(printf '"%s",' "${warn[@]}")" && w=${w%,}
  printf '{"abbruch":null,"llm":{"vcpu":%d,"ramGib":%d,"diskGib":%d,"cpuset":%s},"app":{"vcpu":%d,"ramGib":%d,"diskGib":%d,"cpuset":%s},"warnungen":[%s]}\n' \
    "$llm_cpu" "$llm_ram" "$GROESSEN_LLM_DISK" "$llm_set" "$app_cpu" "$app_ram" "$GROESSEN_APP_DISK" "$app_set" "$w"
}

# groessen_rechner: liest Kerne, Threads, RAM (GiB, abgerundet) und Kern-ID je CPU dieses
# Linux-Rechners und gibt sie als vier Zeilen aus. Kern-ID ist eindeutig über Sockel hinweg.
groessen_rechner() {
  local -a ids=()
  local cpu core sock
  local -A nummer=()
  while IFS=, read -r cpu core sock; do
    [[ "$cpu" == \#* ]] && continue
    [[ -n "${nummer[$sock:$core]:-}" ]] || nummer[$sock:$core]=${#nummer[@]}
    ids[cpu]=${nummer[$sock:$core]}
  done < <(lscpu -p=CPU,CORE,SOCKET)
  echo "${#nummer[@]}"
  echo "${#ids[@]}"
  echo $(($(awk '/^MemTotal:/ {print $2}' /proc/meminfo) / 1024 / 1024))
  (IFS=,; echo "${ids[*]}")
}

# groessen_pinning LLM_VCPU APP_VCPU KERN_JE_CPU_CSV → "LLM_CPUSET APP_CPUSET"
# llm-host: erster Thread der ersten LLM_VCPU Kerne. app-host: unter SMT die Geschwister-
# Threads der ersten Kerne, sonst die ersten Threads der folgenden Kerne.
groessen_pinning() {
  local llm_cpu=$1 app_cpu=$2 topo=$3
  local -a kern_von=() erster=() zweiter=() reihe=() l=() a=()
  local cpu k i smt=0
  IFS=, read -r -a kern_von <<<"$topo"
  for cpu in "${!kern_von[@]}"; do
    k=${kern_von[$cpu]}
    if [[ -z "${erster[$k]:-}" ]]; then
      erster[k]=$cpu
      reihe+=("$k")
    elif [[ -z "${zweiter[$k]:-}" ]]; then
      zweiter[k]=$cpu
      smt=1
    fi
  done
  if ((llm_cpu > ${#reihe[@]} || (smt == 0 && llm_cpu + app_cpu > ${#reihe[@]}) || (smt && app_cpu > ${#reihe[@]}))); then
    echo "groessen_pinning: zu wenige Kerne für $llm_cpu + $app_cpu vCPU" >&2
    return 1
  fi
  for ((i = 0; i < llm_cpu; i++)); do l+=("${erster[${reihe[$i]}]}"); done
  for ((i = 0; i < app_cpu; i++)); do
    if ((smt)); then a+=("${zweiter[${reihe[$i]}]}"); else a+=("${erster[${reihe[$((llm_cpu + i))]}]}"); fi
  done
  echo "$(IFS=,; echo "${l[*]}") $(IFS=,; echo "${a[*]}")"
}

# groessen_pruefen KERNE THREADS RAM_GIB LLM_VCPU LLM_RAM_GIB APP_VCPU APP_RAM_GIB LLM_DISK_GIB APP_DISK_GIB
# Prüft eigene Werte; gibt nichts aus, wenn sie gültig sind, sonst den ersten Fehlercode.
groessen_pruefen() {
  local threads=$2 ram=$3 lv=$4 lr=$5 av=$6 ar=$7 ld=$8 ad=$9 max=$1
  ((max > 8)) && max=8
  if ((lv < 2 || lv > max)); then echo llm-vcpu
  elif ((av < 1)); then echo app-vcpu
  elif ((lv + av > threads)); then echo vcpu-summe
  elif ((lr < 10)); then echo llm-ram
  elif ((ar < 4)); then echo app-ram
  elif ((lr + ar > ram - 2)); then echo ram-summe
  elif ((ld < GROESSEN_LLM_DISK)); then echo llm-disk
  elif ((ad < GROESSEN_APP_DISK)); then echo app-disk
  fi
  return 0
}

# groessen_ressourcen FREI_RAM_GIB FREI_DISK_GIB PLAN_RAM_GIB PLAN_DISK_GIB [RESERVE_GIB, Standard 4]
# Vor dem Anlegen mit dem gerade freien RAM und Platz (Regel in groessen-faelle.json, ressourcenRegel):
# Dem Rechner bleibt mindestens die Reserve an RAM; der Platz reicht für den gemessenen Bedarf (höchstens 31 GiB)
# plus 10 GiB Reserve. Gibt JSON aus: {"abbruch":null|"ram-frei"|"disk-frei","warnungen":[…]}.
groessen_ressourcen() {
  local ram=$1 disk=$2 plan_ram=$3 plan_disk=$4 bedarf=$4 reserve=${5:-4}
  ((bedarf > 31)) && bedarf=31
  if ((ram - plan_ram < reserve)); then
    printf '{"abbruch":"ram-frei","warnungen":[]}\n'
  elif ((disk < bedarf + 10)); then
    printf '{"abbruch":"disk-frei","warnungen":[]}\n'
  elif ((disk < plan_disk + 10)); then
    printf '{"abbruch":null,"warnungen":["disk-wachstum"]}\n'
  else
    printf '{"abbruch":null,"warnungen":[]}\n'
  fi
}
