#!/usr/bin/env bash
# Печатает тело секции CHANGELOG для указанной версии (без строки-заголовка).
# Использование: extract-changelog-section.sh <version> [changelog-path]
set -euo pipefail
version="${1:?нужна версия, напр. 1.2.0}"
file="${2:-CHANGELOG.md}"

[ -f "$file" ] || { echo "ERROR: нет файла $file" >&2; exit 1; }

# Матчим заголовок по префиксу "## [<version>]" (суффикс после ] игнорируем).
# Экранируем спецсимволы версии для литерального совпадения в awk-regex.
section="$(awk -v ver="$version" '
  BEGIN {
    esc = ver; gsub(/[][(){}.^$*+?|\\]/, "\\\\&", esc)
    hdr = "^## \\[" esc "\\]"
  }
  $0 ~ hdr { grab = 1; next }
  grab && /^## / { exit }
  grab { print }
' "$file")"

# Обрезать ведущие и замыкающие пустые строки.
section="$(printf '%s\n' "$section" | sed -e '/./,$!d' | tac | sed -e '/./,$!d' | tac)"

if [ -z "$section" ]; then
  echo "ERROR: секция [$version] не найдена или пуста в $file" >&2
  exit 1
fi
printf '%s\n' "$section"
