#!/bin/bash
# ========================================
# Fix Docker volume permissions for NofyAI
# ========================================

set -e

echo "🔧 Fixing permissions for Docker volumes..."

# Create directories if they don't exist
mkdir -p decision_logs
mkdir -p data

# Set ownership to match Docker container's nextjs user (UID 1001, GID 1001)
echo "📁 Setting ownership to UID 1001 (nextjs user)..."
sudo chown -R 1001:1001 decision_logs
sudo chown -R 1001:1001 data

# Set appropriate permissions (rwxr-xr-x)
echo "🔐 Setting directory permissions..."
sudo chmod -R 755 decision_logs
sudo chmod -R 755 data

echo "✅ Permissions fixed!"
echo ""
echo "Verify with:"
echo "  ls -la decision_logs"
echo "  ls -la data"
