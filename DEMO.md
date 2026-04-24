# ContextMind Demo Guide

## Quick Start (2 minutes)

### Step 1: Start the Backend
```bash
cd backend
npm run dev
```

You should see:
```
✅ MongoDB connected
🚀 Server running on http://localhost:37218
```

### Step 2: Load the Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Navigate to the `chrome-extension` folder in this project
5. Click **Open** or **Select Folder**

The extension should appear in your Chrome toolbar (purple icon).

### Step 3: Test the Extension

1. **Open multiple tabs:**
   - `https://claude.ai` (AI conversation)
   - `https://github.com` (work tab)
   - `https://youtube.com` (noise tab)
   - Any other website

2. **Click the ContextMind icon** in your toolbar

3. **In the popup:**
   - ✅ Claude tab should be checked (AI domain)
   - ✅ GitHub tab should be checked (work)
   - ❌ YouTube tab should be unchecked (noise)
   - Customize selection if desired

4. **Click "Save Context"** button

5. **Watch the status messages:**
   - "Scanning selected tabs..."
   - "Extracting conversations..."
   - "Fetching structured data..."
   - "Compressing context..."
   - "Saving to database..."

6. **Success!** You should see:
   - Green success message with Session ID
   - Summary card showing context saved
   - "Copy Prompt" button

### Step 4: Verify MongoDB Storage

Check MongoDB Compass or via command line:

```bash
mongosh "mongodb+srv://mharshith200_db_user:harshith123@cluster0.iq2r7fl.mongodb.net/" --username mharshith200_db_user --password harshith123

db.sessions.findOne({}, { sort: { timestamp: -1 } })
```

You should see your saved session with:
- `sessionId`: UUID
- `tabs`: Array of captured tabs
- `userSummary`: Generated summary
- `primingPrompt`: LLM-ready context

## API Testing (Optional)

### Using cURL

**Save context:**
```bash
curl -X POST http://localhost:37218/save \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "source": "chrome",
    "timestamp": '$(date +%s)'000,
    "chrome": {
      "tabs": [
        {
          "url": "https://claude.ai/chat",
          "title": "Claude Conversation",
          "content": "User: What is machine learning?\nAssistant: Machine learning is..."
        }
      ],
      "windowId": 123
    }
  }'
```

**Get context:**
```bash
curl -X GET http://localhost:37218/context \
  -H "Authorization: Bearer test-token"
```

## What's Happening Behind the Scenes

### Flow Diagram

```
User clicks "Save Context"
        ↓
Extension collects all open tabs
        ↓
For each selected tab:
  - If AI domain (claude.ai, openai.com, etc)
    → Extract conversation, compress to 500 chars max
  - Else try MCP extraction (YouTube/GitHub/Notion/Docs)
    → Returns structured content
  - If extraction fails
    → Use raw innerText (first 5000 chars)
        ↓
POST to http://localhost:37218/save
        ↓
Backend:
  - Generate UUID sessionId
  - Process tabs
  - Create userSummary (template-based)
  - Create primingPrompt (LLM-ready)
  - Store in MongoDB collection "sessions"
        ↓
Response:
  - sessionId
  - userSummary
  - primingPrompt
        ↓
Extension displays:
  - Success message
  - Summary card
  - Copy button for priming prompt
```

### Tab Classification

| Domain Type | Behavior |
|------------|----------|
| AI (claude.ai, openai.com, etc) | ✅ Checked by default, content extracted as conversation |
| Work (github.com, etc) | ✅ Checked by default, MCP or raw extraction |
| Noise (youtube.com, netflix.com, etc) | ❌ Unchecked by default, user can enable |

## Troubleshooting

### Backend won't start
```
Error: MONGO_URI not provided
```
→ Check `backend/.env` has MongoDB URI

```
Error: MongoDB connection failed
```
→ Verify URI is correct and MongoDB Atlas allows your IP

### Extension not loading
- Check `chrome://extensions/` → Developer mode is ON
- Look for red error messages in Developer mode
- Check Chrome DevTools console (F12)

### No tabs showing in popup
- Ensure extension has `<all_urls>` permission
- Reload the extension (in Developer mode: click ↻)
- Open a new tab and try again

### Backend not receiving data
```
Error: Failed to save context
```
→ Verify backend is running on `http://localhost:37218`
→ Check backend console for errors
→ Open DevTools (F12) in Chrome and check Network tab

### Content not extracting
- Some sites block content scripts
- Check manifest.json permissions
- Fallback: raw `document.body.innerText` is used (first 5000 chars)

## Demo Talking Points

1. **One-Click Context Capture**: Just hit "Save Context" and everything is captured
2. **Smart Classification**: AI tabs recognized, noise filtered, work tabs prioritized
3. **Priming Prompts**: Copy the prompt and paste into a new AI chat to resume without re-explaining
4. **MongoDB Persistence**: Sessions stored permanently, can retrieve and compare later
5. **MCP-Ready**: Extensible architecture for YouTube, GitHub, Notion, Google Docs extraction
6. **Fallback Handling**: Even if extraction fails, raw content is captured

## Future Demo Features

- [ ] Load previous sessions from MongoDB
- [ ] Compare context snapshots across time
- [ ] Show extracted vs. raw content side-by-side
- [ ] Demonstrate real API integrations (GitHub/Notion/YouTube)
- [ ] Export context as markdown or PDF
- [ ] Real Clerk authentication flow

---

**Demo ready. Just start the backend and load the extension. 🚀**
