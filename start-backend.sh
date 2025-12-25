#!/bin/bash
# Start the Flask backend server

cd "$(dirname "$0")/backend"
source venv/bin/activate

echo "🚀 Starting Flask backend on http://127.0.0.1:5001"
echo "Press Ctrl+C to stop"
echo ""

PORT=5001 FLASK_APP=app.py python3 -m flask run --host=127.0.0.1 --port=5001


