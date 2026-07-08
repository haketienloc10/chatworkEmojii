#!/bin/sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_DIR="${1:-"${ROOT_DIR}/../chatworkEmojii-v2"}"

mkdir -p "${TARGET_DIR}"

cp -f \
  "${ROOT_DIR}/manifest.json" \
  "${ROOT_DIR}/popup.html" \
  "${ROOT_DIR}/styles.css" \
  "${ROOT_DIR}/README.md" \
  "${ROOT_DIR}/package.json" \
  "${ROOT_DIR}/getImage.js" \
  "${TARGET_DIR}/"

for directory in scripts data icons; do
  mkdir -p "${TARGET_DIR}/${directory}"
  cp -R "${ROOT_DIR}/${directory}/." "${TARGET_DIR}/${directory}/"
done

echo "Synced extension source to ${TARGET_DIR}"
