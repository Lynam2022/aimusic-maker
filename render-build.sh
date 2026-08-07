#!/bin/bash
# render-build.sh — Script build cho Render.com Node.js service
# Render chạy build command này thay vì npm ci mặc định

set -e

echo "📦 Installing npm dependencies..."
npm install

echo "🎭 Installing Playwright Chromium browser..."
npx playwright install chromium
echo "✅ Playwright Chromium installed."

echo "🗄️ Generating Prisma client..."
npx prisma generate

echo "🏗️ Building Next.js app..."
npm run build

echo "✅ Build complete!"
