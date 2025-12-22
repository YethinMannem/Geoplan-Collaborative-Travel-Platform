#!/bin/bash

# Script to help set up the .env file for Google Maps API

echo "🔧 Google Maps API Key Setup"
echo "============================"
echo ""

# Check if .env file exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists"
    read -p "Do you want to overwrite it? (y/n): " overwrite
    if [ "$overwrite" != "y" ]; then
        echo "Keeping existing .env file"
        exit 0
    fi
fi

echo ""
echo "To get your Google Maps API key:"
echo "1. Go to https://console.cloud.google.com/"
echo "2. Create/select a project"
echo "3. Enable billing (required, but free tier available)"
echo "4. Enable 'Maps JavaScript API' and 'Places API'"
echo "5. Go to APIs & Services → Credentials"
echo "6. Create Credentials → API Key"
echo "7. Copy your API key"
echo ""
read -p "Enter your Google Maps API key: " api_key

if [ -z "$api_key" ]; then
    echo "❌ No API key provided. Exiting."
    exit 1
fi

# Create .env file
cat > .env << EOF
# Google Maps API Configuration
REACT_APP_GOOGLE_MAPS_API_KEY=$api_key

# Backend API URL
REACT_APP_API_BASE=http://localhost:5001
EOF

echo ""
echo "✅ .env file created successfully!"
echo ""
echo "⚠️  IMPORTANT: Restart your development server for changes to take effect:"
echo "   1. Stop the server (Ctrl+C)"
echo "   2. Run: npm start"
echo ""

