#!/bin/bash

echo "🔍 ContextMind Build Verification"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_file() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}✅${NC} $1"
    return 0
  else
    echo -e "${RED}❌${NC} $1 (missing)"
    return 1
  fi
}

check_dir() {
  if [ -d "$1" ]; then
    echo -e "${GREEN}✅${NC} $1/"
    return 0
  else
    echo -e "${RED}❌${NC} $1/ (missing)"
    return 1
  fi
}

# Backend files
echo "📦 Backend Files:"
check_file "backend/package.json"
check_file "backend/tsconfig.json"
check_file "backend/.env"
check_file "backend/src/server.ts"
check_file "backend/src/db.ts"
check_file "backend/src/routes/save.ts"
check_file "backend/src/routes/context.ts"
check_file "backend/src/mcp/router.ts"
check_file "backend/src/mcp/youtube.ts"
check_file "backend/src/mcp/github.ts"
check_file "backend/src/mcp/notion.ts"
check_file "backend/src/mcp/gdocs.ts"

echo ""
echo "🎨 Extension Files:"
check_file "chrome-extension/manifest.json"
check_file "chrome-extension/src/popup/index.html"
check_file "chrome-extension/src/popup/popup.js"
check_file "chrome-extension/src/content/content.js"
check_file "chrome-extension/src/background/background.js"

echo ""
echo "📚 Documentation:"
check_file "README.md"
check_file "DEMO.md"
check_file "DEV_SETUP.md"
check_file "BUILD_STATUS.md"
check_file "test-api.sh"
check_file "verify-build.sh"

echo ""
echo "📂 Directories:"
check_dir "backend/src"
check_dir "backend/src/routes"
check_dir "backend/src/mcp"
check_dir "backend/node_modules"
check_dir "chrome-extension/src"
check_dir "chrome-extension/src/popup"
check_dir "chrome-extension/src/content"
check_dir "chrome-extension/src/background"

echo ""
echo "✅ Verification complete!"
echo ""
echo "🚀 Next steps:"
echo "  1. cd backend && npm run dev"
echo "  2. Chrome → chrome://extensions/ → Load unpacked"
echo "  3. Select chrome-extension folder"
echo "  4. Test the extension!"
