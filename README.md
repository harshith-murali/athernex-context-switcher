# ContextMind - Chrome Extension

A Chrome extension that captures your AI workflow context and saves it to MongoDB with one click.

## Features

- **One-Click Context Saving**: Click "Save Context" to capture your active workspace
- **Smart Tab Classification**: AI tabs, work tabs, and noise tabs are auto-classified
- **Structured Data Extraction**: MCP layer extracts content from YouTube, GitHub, Notion, Google Docs
- **Fallback Support**: If extraction fails, raw content is captured
- **Priming Prompts**: Generate LLM-ready prompts to resume work without re-explaining
- **MongoDB Persistence**: All context stored for future retrieval

## Tech Stack

**Backend:**
- Node.js + Express
- TypeScript
- MongoDB

**Frontend:**
- Chrome Extension (Manifest V3)
- Vanilla JavaScript

**MCP Connectors:**
- YouTube (stub)
- GitHub (stub)
- Notion (stub)
- Google Docs (stub)

## Project Structure

```
contextmind/
├── backend/
│   ├── src/
│   │   ├── server.ts          # Main Express server
│   │   ├── db.ts              # MongoDB connection
│   │   ├── routes/
│   │   │   ├── save.ts        # POST /save endpoint
│   │   │   └── context.ts     # GET /context endpoint
│   │   └── mcp/
│   │       ├── router.ts      # MCP routing logic
│   │       ├── youtube.ts     # YouTube connector
│   │       ├── github.ts      # GitHub connector
│   │       ├── notion.ts      # Notion connector
│   │       └── gdocs.ts       # Google Docs connector
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                   # MongoDB URI (provided)
│
└── chrome-extension/
    ├── manifest.json
    └── src/
        ├── popup/
        │   ├── index.html     # Extension popup UI
        │   └── popup.js       # Popup logic
        ├── content/
        │   └── content.js     # Content script for tab scraping
        └── background/
            └── background.js  # Background service worker
```

## Setup Instructions

### 1. Backend Setup

```bash
cd backend
npm install
# Check .env for MongoDB URI (already configured)
npm run dev
```

Server will start at `http://localhost:37218`

### 2. Chrome Extension Setup

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder
5. The extension will appear in your toolbar

### 3. Testing the Extension

1. Open multiple tabs (AI tabs, work tabs, noise tabs)
2. Click the ContextMind extension icon
3. The popup will show all tabs with auto-classification
4. Check/uncheck tabs as needed
5. Click "Save Context"
6. Watch the status messages as it processes
7. Once saved, copy the priming prompt and test in an AI chat

## API Endpoints

### POST /save
Saves a context snapshot to MongoDB.

**Request:**
```json
{
  "source": "chrome",
  "timestamp": 1234567890,
  "chrome": {
    "tabs": [
      {
        "url": "https://claude.ai/...",
        "title": "Claude Conversation",
        "content": "..."
      }
    ],
    "windowId": 123
  }
}
```

**Headers:**
```
Authorization: Bearer <clerk_token>
Content-Type: application/json
```

**Response:**
```json
{
  "sessionId": "uuid-xxx",
  "status": "success",
  "userSummary": "You were working on 2 AI conversations...",
  "primingPrompt": "I was working on the following context..."
}
```

### GET /context
Fetches the latest saved context for a user.

**Headers:**
```
Authorization: Bearer <clerk_token>
```

**Response:**
```json
{
  "sessionId": "uuid-xxx",
  "userSummary": "...",
  "primingPrompt": "...",
  "tabs": [...],
  "timestamp": 1234567890
}
```

## Tab Classification

**AI Domains** (auto-checked):
- claude.ai
- chat.openai.com
- gemini.google.com
- cursor.sh
- perplexity.ai

**Noise Domains** (auto-unchecked):
- youtube.com
- netflix.com
- twitter.com
- reddit.com
- instagram.com
- twitch.tv
- spotify.com
- tiktok.com

**Work Domains** (auto-checked):
- Everything else

## MongoDB Schema

**Collection: sessions**

```javascript
{
  _id: ObjectId,
  sessionId: String,      // UUID
  userId: String,         // From Clerk token
  timestamp: Number,      // Unix timestamp
  chromePayload: {
    windowId: Number,
    tabsCount: Number
  },
  userSummary: String,    // Generated summary
  primingPrompt: String,  // LLM-ready prompt
  tabs: [
    {
      url: String,
      title: String,
      content: String,
      sourceType: "ai" | "mcp" | "raw"
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

## Data Flow

1. **Extension Popup**: User selects tabs and clicks "Save Context"
2. **Content Scripts**: Extension extracts content from selected tabs
3. **Backend API**: Payload sent to `/save` endpoint
4. **Processing**:
   - Tab content is processed (AI conversations compressed, MCP extraction attempted)
   - User summary is generated
   - Priming prompt is created
5. **Storage**: Session saved to MongoDB
6. **Response**: Extension shows summary and copy-prompt button

## Error Handling

- **MCP Extraction Fails**: Falls back to raw `innerText`
- **API Error**: Shows error message, allows retry
- **Empty Selection**: Prevents saving with 0 tabs
- **No Content**: Falls back to empty string instead of failing

## Future Enhancements

- Real Clerk authentication integration
- API implementations for YouTube, GitHub, Notion, Google Docs
- Advanced compression algorithms for large conversations
- User history/previous sessions view
- Context merging and deduplication
- Export functionality (PDF, markdown)

## Troubleshooting

**Extension not showing tabs?**
- Ensure all permissions are granted in manifest.json
- Check browser console (F12) for errors
- Try reloading the extension

**Backend not receiving data?**
- Verify `http://localhost:37218` is accessible
- Check MongoDB connection with `.env` URI
- Review backend console for errors

**Content not extracting?**
- Some sites block content scripts - check manifest permissions
- AI sites may need custom selectors (check content.js)
- Fallback to raw `document.body.innerText` works for most sites

---

**Built for hackathon speed. Demo-ready in one click. 🚀**