# Testing Guide for Context-Switcher

## ✅ Backend Status

The backend is running on `http://localhost:37218` with:
- ✅ MongoDB connected and storing sessions
- ✅ ChatGPT message extraction working
- ✅ YouTube metadata extraction working (via oEmbed API)
- ✅ Structured data enrichment pipeline functional

## 📋 How to Test with Chrome Extension

### 1. Load the Extension into Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Navigate to `/Users/muralic/Desktop/Projects/Context-Switcher/chrome-extension/`
5. Select and load the extension

### 2. Test Data Extraction

Open the following tabs:
- **Claude.ai**: Open a conversation with any AI topic
- **ChatGPT**: Open a conversation 
- **YouTube**: Open any video (e.g., https://www.youtube.com/watch?v=9bZkp7q19f0)
- **GitHub**: Open any repo (e.g., https://github.com/anthropics/anthropic-sdk-python)
- **Regular webpage**: Open any other site

### 3. Save Context

1. Click the Context-Switcher extension icon in the Chrome toolbar
2. You should see all open tabs listed with badges:
   - "AI" badge: Claude, ChatGPT, Gemini, Perplexity, Cursor
   - "Noise" badge: YouTube, Netflix, Twitter, Reddit, Instagram, TikTok, etc.
3. The AI and regular work tabs should be checked by default; noise tabs unchecked
4. Click "Save Context"
5. Watch the status messages: Scanning → Extracting → Fetching → Compressing → Saving
6. You should see "✅ Context saved! Session ID: ..."

### 4. Verify Data in MongoDB

Run this to see the last saved context:

```bash
curl -s http://localhost:37218/context \
  -H "Authorization: Bearer test-token" | jq '.'
```

You should see:
- ✅ `structuredData.chrome.tabs[0]` with ChatGPT messages extracted
- ✅ `structuredData.chrome.tabs[1]` with Claude messages extracted
- ✅ `structuredData.chrome.tabs[2]` with YouTube title and metadata
- ✅ `structuredData.chrome.tabs[3]` with GitHub repo info (if extraction implemented)

### 5. Test Specific Platform Extraction

#### ChatGPT Messages
Expected output in MongoDB:
```json
{
  "url": "https://chat.openai.com/...",
  "title": "ChatGPT conversation",
  "isAITab": true,
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

#### Claude Messages
Expected output in MongoDB:
```json
{
  "url": "https://claude.ai/...",
  "title": "Claude conversation",
  "isAITab": true,
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

#### YouTube
Expected output in MongoDB:
```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "title": "Original Video Title",
  "isAITab": false,
  "content": "YouTube: Video Title"
}
```

## 🔍 Debugging

### Backend Logs
Watch backend output with:
```bash
tail -f /tmp/backend.log | grep "🎥\|✅\|❌"
```

Look for:
- `🎥 [YouTube] Starting extraction` = extraction triggered
- `🎥 [YouTube] Successfully extracted` = extraction succeeded
- `❌ [YouTube] Error during extraction` = extraction failed

### Chrome Extension Console
1. Right-click the extension icon → "Inspect popup"
2. Go to the "Console" tab
3. Click "Save Context" and watch for:
   - Network requests to `/save` endpoint
   - Response status codes
   - Any error messages

## 📝 Notes

- **YouTube API**: Uses public oEmbed API (no authentication needed)
- **ChatGPT Selectors**: Multiple fallbacks in case ChatGPT DOM changes
- **Claude Selectors**: Uses data-testid attributes for reliability
- **Rate Limiting**: YouTube oEmbed API has generous rate limits (~100/min)

## Next Steps

If tests pass:
1. Test with real user workflows (context switching scenarios)
2. Add GitHub repo extraction (implement `githubExtract()`)
3. Consider adding more platforms (Notion, Google Docs if needed)
4. Deploy backend to production server
