#!/usr/bin/env bash
echo "Starting CardioVision AI..."
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi
echo "Server running at http://localhost:3000"
npm start
