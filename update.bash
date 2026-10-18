#!/bin/bash
set -e
cd "$(dirname "$0")"
export PATH="/opt/jinrou-node22/bin:$PATH"
git pull
cd front/
npm run clean
npm run production-build
cd ..
echo '构建完成。执行 systemctl restart jinrou 重启网站。'
