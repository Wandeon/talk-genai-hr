#!/bin/bash
# Manual deployment package creator

echo "Creating deployment package..."

# Create temp directory
TEMP_DIR=$(mktemp -d)
PACKAGE_NAME="voice-chat-app-$(date +%Y%m%d-%H%M%S).tar.gz"

echo "Copying files to $TEMP_DIR..."
cp -r /home/wandeon/voice-chat-app "$TEMP_DIR/voice-chat-app"

cd "$TEMP_DIR/voice-chat-app"

# Clean up development files
echo "Cleaning development files..."
rm -rf backend/node_modules frontend/node_modules
rm -rf backend/coverage frontend/coverage
rm -rf .git .github
rm -f backend/conversations.db
rm -f *.log
find . -name ".DS_Store" -delete
find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

# Create deployment tarball
echo "Creating tarball..."
cd "$TEMP_DIR"
tar -czf "$PACKAGE_NAME" voice-chat-app/

# Move to home directory
mv "$PACKAGE_NAME" /home/wandeon/

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "✓ Deployment package created: /home/wandeon/$PACKAGE_NAME"
echo ""
echo "Package size: $(du -h /home/wandeon/$PACKAGE_NAME | cut -f1)"
echo ""
echo "Next steps:"
echo "  1. Transfer package to vps-00:"
echo "     scp /home/wandeon/$PACKAGE_NAME vps-00:/tmp/"
echo ""
echo "  2. SSH to vps-00 and run:"
echo "     ssh vps-00"
echo "     cd /tmp"
echo "     tar -xzf $PACKAGE_NAME"
echo "     sudo rm -rf /opt/voice-chat-app.old"
echo "     sudo mv /opt/voice-chat-app /opt/voice-chat-app.old 2>/dev/null || true"
echo "     sudo mv voice-chat-app /opt/"
echo "     cd /opt/voice-chat-app"
echo "     cd backend && npm install --production"
echo "     cd ../frontend && npm install --production && npm run build"
echo "     cd .."
echo "     docker-compose down"
echo "     docker-compose up -d --build"
echo "     ./scripts/verify-deployment.sh"
echo ""
