# Quick Start Guide

## Start Backend
```bash
cd backend && npm run dev
# Runs on http://localhost:37218
```

## Load Chrome Extension
1. Go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select `/Users/muralic/Desktop/Projects/Context-Switcher/chrome-extension/`

## Test Data Extraction
1. Open tabs with AI content: claude.ai, chat.openai.com, youtube.com
2. Click extension icon → Select tabs → Click "Save Context"
3. Watch status messages appear (Scanning → Saving)
4. Check MongoDB:
   ```bash
   curl -s http://localhost:37218/context \
     -H "Authorization: Bearer test-token" | jq '.'
   ```

## What Gets Extracted

| Platform | Type | Method | Status |
|----------|------|--------|--------|
| Claude.ai | AI Messages | DOM selectors `[data-testid="human/assistant-turn"]` | ✅ |
| ChatGPT | AI Messages | DOM selectors `[data-message-author-role]` | ✅ |
| Gemini | AI Messages | DOM selectors `.user-query-container` | ✅ |
| YouTube | Metadata | oEmbed API | ✅ |
| GitHub | Repo Info | (Stub - ready for implementation) | ⏳ |
| Any Website | Content | Fallback innerText extraction | ✅ |

## Verify It's Working

### Check backend logs:
```bash
tail -f /tmp/backend.log | grep "🎥\|✅\|❌"
```

### Inspect MongoDB:
```bash
# Get last saved context
curl -s http://localhost:37218/context \
  -H "Authorization: Bearer test-token" | jq '.structuredData.chrome.tabs'

# Check specific tab type
curl -s http://localhost:37218/context \
  -H "Authorization: Bearer test-token" | jq '.structuredData.chrome.tabs[0].messages'
```

### View browser console:
1. Right-click extension → "Inspect popup"
2. Go to "Console" tab
3. Click "Save Context" and watch for errors

## Common Issues

| Issue | Solution |
|-------|----------|
| Port 37218 already in use | `lsof -ti:37218 \| xargs kill -9` |
| Extension not loading | Check manifest.json is in correct folder |
| No messages extracted | Check that page is fully loaded before saving |
| YouTube title not showing | Video ID might not exist (use https://www.youtube.com/watch?v=dQw4w9WgXcQ for testing) |

## Files to Check

- **Frontend logic**: `chrome-extension/src/content/content.js`
- **UI/backend communication**: `chrome-extension/src/popup/popup.js`
- **Backend processing**: `backend/src/routes/save.ts`
- **YouTube extraction**: `backend/src/mcp/youtube.ts`
- **Database schema**: `backend/src/db.ts`

## Status Summary

✅ **Working**: ChatGPT extraction, Claude extraction, YouTube metadata, basic content extraction
⏳ **Ready to implement**: GitHub repo extraction (follows same pattern as YouTube)
