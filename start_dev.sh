#!/bin/sh
set -e

cd "$(dirname "$0")/app"

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

exec npm run dev
