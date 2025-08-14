#!/bin/bash

cd node_modules/better-sqlite3
node-gyp rebuild --target=30.5.1 --arch=arm64 --dist-url=https://electronjs.org/headers
cd ../../

echo "🔨 Building server backend..."
cd apps/server-backend
npm run build
cd ../../

npm run dev