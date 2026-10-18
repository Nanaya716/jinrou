#!/bin/bash
set -e
cd "$(dirname "$0")"
export PATH="/opt/jinrou-node22/bin:$PATH"
before=$(git rev-parse HEAD)
git pull
if ! git diff --quiet "$before" HEAD -- package.json package-lock.json; then
    npm ci --omit=dev
fi
if ! git diff --quiet "$before" HEAD -- front/package.json front/package-lock.json; then
    npm --prefix front ci
fi
cd front/
npm run clean
npm run production-build
cd ..
systemctl restart jinrou
echo '网站更新完成。'
