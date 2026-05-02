#!/bin/bash

echo "⬇️ Pulling latest code..."
git pull

echo "📦 Installing dependencies..."
npm install

echo "🚀 Starting dev server..."
npm run dev

