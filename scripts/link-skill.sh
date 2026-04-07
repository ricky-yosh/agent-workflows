#!/usr/bin/env bash
set -euo pipefail

AW_SKILLS="$(cd "$(dirname "$0")/../skills" && pwd)"
GLOBAL_SKILLS="$HOME/.claude/skills"

# Usage
if [ $# -eq 0 ]; then
  echo "Usage: link-skill.sh <skill-name> [skill-name ...]"
  echo "       link-skill.sh --list"
  echo "       link-skill.sh --unlink <skill-name>"
  echo ""
  echo "Available skills:"
  find "$AW_SKILLS" -name SKILL.md -mindepth 2 -maxdepth 3 \
    | sed "s|$AW_SKILLS/||; s|/SKILL.md||" \
    | sort \
    | while read -r skill; do
        base=$(basename "$skill")
        if [ -L "$GLOBAL_SKILLS/$base" ]; then
          echo "  $skill  (linked)"
        else
          echo "  $skill"
        fi
      done
  exit 0
fi

# --list: show what's currently linked
if [ "$1" = "--list" ]; then
  echo "Linked aw skills:"
  for dir in "$GLOBAL_SKILLS"/*/; do
    [ -L "${dir%/}" ] || continue
    target=$(readlink "${dir%/}")
    case "$target" in
      "$AW_SKILLS"*) echo "  $(basename "${dir%/}") -> $target" ;;
    esac
  done
  exit 0
fi

# --unlink: remove symlink
if [ "$1" = "--unlink" ]; then
  shift
  for name in "$@"; do
    link="$GLOBAL_SKILLS/$name"
    if [ -L "$link" ]; then
      rm "$link"
      echo "Unlinked $name"
    else
      echo "Not linked: $name" >&2
    fi
  done
  exit 0
fi

# Link skills
for name in "$@"; do
  # Find the skill directory (match by basename)
  match=$(find "$AW_SKILLS" -type d -name "$name" -mindepth 1 -maxdepth 2 | head -1)

  if [ -z "$match" ] || [ ! -f "$match/SKILL.md" ]; then
    echo "Skill not found: $name" >&2
    echo "Run with no args to see available skills."
    exit 1
  fi

  link="$GLOBAL_SKILLS/$name"

  if [ -L "$link" ]; then
    echo "Already linked: $name"
  elif [ -d "$link" ]; then
    echo "Conflict: $link already exists and is not a symlink" >&2
    exit 1
  else
    ln -s "$match" "$link"
    echo "Linked $name -> $match"
  fi
done
