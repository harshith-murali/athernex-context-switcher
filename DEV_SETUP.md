# ContextMind - Development Setup

## Prerequisites

- **Node.js** v18+ (with npm)
- **MongoDB** (Atlas or local)
- **Chrome** browser (with Developer mode enabled)
- **macOS/Linux/Windows**

## Initial Setup

### 1. Clone & Install Backend

```bash
cd backend
npm install
```

### 2. Configure MongoDB

The `.env` file already contains the MongoDB URI:

```env
MONGO_URI=mongodb+srv://mharshith200_db_user:harshith123@cluster0.iq2r7fl.mongodb.net/
PORT=37218
```

**To test the connection:**

```bash
# Using mongosh CLI (if installed)
mongosh "mongodb+srv://mharshith200_db_user:harshith123@cluster0.iq2r7fl.mongodb.net/" \
  --username mharshith200_db_user \
  --password harshith123

# In mongosh shell:
> use admin
> db.adminCommand({ ping: 1 })
# Should return: { ok: 1 }
```

### 3. Start Backend Server

```bash
cd backend
npm run dev
```

Expected output:
```
✅ MongoDB connected
🚀 Server running on http://localhost:37218
```

The server watches for TypeScript changes and auto-reloads.

### 4. Load Chrome Extension

1. Open Chrome: `chrome://extensions/`
2. Enable **Developer mode** (toggle top right)
3. Click **Load unpacked**
4. Select the `chrome-extension` folder
5. The extension icon appears in your toolbar

## Development Workflow

### Backend Development

**File Structure:**
```
backend/
├── src/
│   ├── server.ts          # Express app setup
│   ├── db.ts              # MongoDB connection & schema
│   ├── routes/
│   │   ├── save.ts        # POST /save endpoint
│   │   └── context.ts     # GET /context endpoint
│   └── mcp/
│       ├── router.ts      # MCP dispatcher
│       ├── youtube.ts     # YouTube stub
│       ├── github.ts      # GitHub stub
│       ├── notion.ts      # Notion stub
│       └── gdocs.ts       # Google Docs stub
├── package.json
├── tsconfig.json
└── .env                   # Environment variables
```

**Making Changes:**
1. Edit TypeScript files in `src/`
2. Server auto-reloads via `tsx --watch`
3. Test endpoints via `test-api.sh` or cURL

**Adding a New Endpoint:**
```typescript
// backend/src/routes/myroute.ts
import { Router } from "express";

const router = Router();

router.post("/my-endpoint", (req, res) => {
  try {
    // Your logic here
    res.json({ status: "success" });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
```

Then import in `server.ts`:
```typescript
import myRouter from "./routes/myroute.ts";
app.use(myRouter);
```

### Frontend Development

**File Structure:**
```
chrome-extension/
├── manifest.json          # Extension config (Manifest V3)
└── src/
    ├── popup/
    │   ├── index.html     # Popup UI
    │   └── popup.js       # Popup logic & API calls
    ├── content/
    │   └── content.js     # Content script (runs in page)
    └── background/
        └── background.js  # Service worker
```

**Making Changes:**
1. Edit files in `chrome-extension/`
2. **Do NOT need to reload** for HTML/CSS changes (except manifest changes)
3. **Must reload** if you change:
   - `manifest.json`
   - Background service worker (`background.js`)
   - Content script (`content.js`)

**To reload:**
- Go to `chrome://extensions/`
- Find "ContextMind"
- Click the refresh icon (↻)

**Testing popup UI:**
1. Click the ContextMind icon
2. Open DevTools (F12) → **Console**
3. Errors appear here
4. Use `console.log()` to debug

**Testing content script:**
1. Open any webpage
2. Right-click → **Inspect**
3. Go to **Console** tab
4. Messages from content script appear here

## Testing

### Test API Endpoints

```bash
./test-api.sh
```

Or use cURL manually:

```bash
# Health check
curl http://localhost:37218/health

# Save context
curl -X POST http://localhost:37218/save \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "source": "chrome",
    "timestamp": 1234567890000,
    "chrome": {
      "tabs": [
        {
          "url": "https://claude.ai",
          "title": "Claude",
          "content": "User: hi\nAssistant: Hello!"
        }
      ],
      "windowId": 1
    }
  }' | jq .

# Get context
curl http://localhost:37218/context \
  -H "Authorization: Bearer test-token" | jq .
```

### Test Extension Flow

1. **Open test tabs:**
   - `https://claude.ai`
   - `https://github.com`
   - `https://youtube.com`

2. **Click extension icon**

3. **Verify tab classification:**
   - Claude → checked (AI)
   - GitHub → checked (work)
   - YouTube → unchecked (noise)

4. **Click "Save Context"**

5. **Monitor:**
   - Backend console (logs each step)
   - Browser DevTools console (F12)
   - MongoDB (check `db.sessions.findOne()`)

6. **Verify response:**
   - See summary card
   - Copy prompt button works
   - Check session saved in MongoDB

## Debugging

### Backend Issues

**Check the logs:**
```bash
npm run dev
# Watch console output for errors
```

**Common issues:**

| Problem | Solution |
|---------|----------|
| `MONGO_URI not provided` | Check `.env` file exists |
| `connect ECONNREFUSED` | MongoDB not accessible (check network) |
| `TypeError: Cannot read property 'tabs'` | Payload missing `chrome.tabs` array |
| Port 37218 already in use | Kill the process: `lsof -ti:37218 \| xargs kill` |

### Extension Issues

**DevTools Console (F12):**
```javascript
// Try sending message to background
chrome.runtime.sendMessage({ test: "hello" }, response => {
  console.log("Response:", response);
});

// Check storage
chrome.storage.local.get(null, items => {
  console.log("Storage:", items);
});
```

**Extension Developer Mode:**
- Go to `chrome://extensions/`
- Find "ContextMind" → click "Details"
- Look for error messages
- Click "Errors" to see recent errors

**Content script issues:**
- Open DevTools on any website
- Go to **Console** tab
- Content script errors appear here
- Use `console.log()` in content.js to debug

## Database Schema Reference

### `sessions` Collection

```javascript
{
  _id: ObjectId("..."),
  sessionId: "uuid-v4-string",
  userId: "clerk-user-id-or-test-user",
  timestamp: 1234567890000,
  
  chromePayload: {
    windowId: 123,
    tabsCount: 3
  },
  
  userSummary: "You were working on 2 AI conversations and 1 work tab.",
  primingPrompt: "I was working on the following context...",
  
  tabs: [
    {
      url: "https://claude.ai/chat",
      title: "Claude Conversation",
      content: "User: ... Assistant: ...",
      sourceType: "ai"
    },
    {
      url: "https://github.com/repo",
      title: "GitHub Repo",
      content: "[GitHub repo content]",
      sourceType: "mcp"
    },
    {
      url: "https://example.com",
      title: "Web Page",
      content: "Page text content...",
      sourceType: "raw"
    }
  ],
  
  createdAt: ISODate("2025-04-24T10:30:00Z"),
  updatedAt: ISODate("2025-04-24T10:30:00Z")
}
```

## Environment Variables

```env
# backend/.env
MONGO_URI=mongodb+srv://...  # MongoDB connection string
PORT=37218                   # Backend server port
```

## Useful Commands

```bash
# Backend
cd backend
npm install              # Install dependencies
npm run dev             # Start with auto-reload
npm run build           # Compile TypeScript to dist/

# Extension (Chrome)
# - Navigate to chrome://extensions/
# - Toggle Developer mode
# - Click "Load unpacked" → select chrome-extension folder

# Testing
./test-api.sh           # Run API tests
mongosh "..."           # Connect to MongoDB

# Utilities
lsof -ti:37218 | xargs kill    # Kill process on port 37218
ps aux | grep node             # List all Node processes
```

## Architecture Overview

```
USER BROWSER
    ↓
[Chrome Extension Popup]
    - Lists all open tabs
    - User selects which to save
    - Shows progress messages
    ↓
[Content Scripts]
    - Extract text from each tab
    - Special handling for AI sites
    ↓
[POST /save API]
    - Backend receives payload
    - Processes tabs (compression, MCP extraction)
    - Generates summary & prompt
    ↓
[MongoDB]
    - Stores session in "sessions" collection
    ↓
[Response]
    - Extension shows summary
    - User can copy priming prompt
    ↓
[GET /context API]
    - Retrieves latest session
    - Returns for resuming work
```

## Next Steps

1. **Backend**: Implement real API integrations
   - YouTube API for video transcripts
   - GitHub API for repo/PR context
   - Notion API for page content
   - Google Docs API for document content

2. **Frontend**: Add authentication
   - Integrate Clerk (sign-in, tokens)
   - Store tokens securely in chrome.storage
   - Pass JWT to backend

3. **Features**: Session management
   - List all saved sessions
   - Compare snapshots over time
   - Export as markdown/PDF
   - Search across contexts

4. **UX**: Polish & performance
   - Better compression algorithms
   - Streaming large content
   - Batch processing for many tabs

---

**Happy hacking! 🚀**
