#!/bin/bash
echo "Installing dependencies..."
npm install --omit=dev
echo "Running build..."
npm run build
echo "Deployment complete!"
