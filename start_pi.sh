#!/bin/bash
# start_pi.sh
# Deployment script for Saffron Hub on Raspberry Pi

# Enable strict mode
set -e

# Configuration
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
FRONTEND_PORT=3000

echo "🌱 Starting Saffron Hub Deployment on Raspberry Pi..."

# 1. Start the Python Backend
echo "⚙️  Starting FastAPI Backend..."
cd "$BACKEND_DIR"
# Assuming virtual environment is named venv
if [ -d "venv" ]; then
    source venv/bin/activate
fi
# Start uvicorn in the background
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend started with PID: $BACKEND_PID"

# 2. Start the Next.js Frontend
echo "🖥️  Starting Next.js Frontend..."
cd "$FRONTEND_DIR"
# Next.js should be built before starting for production
if [ ! -d ".next" ]; then
    echo "🏗️  Building Next.js for production..."
    npm run build
fi
# Start Next.js in the background
nohup npm start -- -p $FRONTEND_PORT > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✅ Frontend started with PID: $FRONTEND_PID"

# 3. Wait for frontend to be ready
echo "⏳ Waiting for services to initialize..."
sleep 5

# 4. Start Cloudflare Tunnel
echo "🌐 Starting Cloudflare Tunnel..."
echo "NOTE: Ensure 'cloudflared' is installed on your Raspberry Pi."
echo "Running quick tunnel to port $FRONTEND_PORT..."

# Run cloudflared and extract the public URL
nohup cloudflared tunnel --url http://127.0.0.1:$FRONTEND_PORT > tunnel.log 2>&1 &
TUNNEL_PID=$!

sleep 5
# Extract the trycloudflare URL from the log
PUBLIC_URL=$(grep -o 'https://[^ ]*\.trycloudflare\.com' tunnel.log | head -1)

if [ -n "$PUBLIC_URL" ]; then
    echo ""
    echo "=========================================================="
    echo "🚀 SAFFRON HUB IS LIVE!"
    echo "Access your dashboard anywhere:"
    echo "👉 $PUBLIC_URL"
    echo "=========================================================="
else
    echo "⚠️  Could not automatically find the tunnel URL."
    echo "Please check frontend/tunnel.log for your Cloudflare link."
fi

# Function to handle script termination
cleanup() {
    echo "🛑 Stopping Saffron Hub..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    kill $TUNNEL_PID 2>/dev/null
    echo "Goodbye."
}

# Trap exit signals
trap cleanup EXIT INT TERM

echo "Press Ctrl+C to stop all services."
# Keep script running to maintain processes
wait
