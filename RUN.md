# Run ContextMind

## Start the Backend

```bash
cd backend
npm run dev
```

Expected output:
```
✅ MongoDB connected
🚀 Server running on http://localhost:37218
```

The server auto-reloads on TypeScript changes.

## Load the Extension

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `chrome-extension` folder
5. Done! Extension icon appears in your toolbar

## Test It

1. Open multiple tabs:
   - `https://claude.ai` (will be marked as AI)
   - `https://github.com` (will be marked as work)
   - `https://youtube.com` (will be marked as noise)

2. Click the ContextMind extension icon

3. Verify classification:
   - ✅ Claude: checked (blue AI badge)
   - ✅ GitHub: checked
   - ❌ YouTube: unchecked (gray Noise badge)

4. Click **"Save Context"** button

5. Watch status messages appear, then see:
   - ✅ Green success message
   - Summary card with your context
   - Copy button for the priming prompt

6. Click **"Copy Prompt"** and paste into Claude/ChatGPT to resume work

## Verify it Worked

Check MongoDB for saved session:
```bash
mongosh "mongodb+srv://mharshith200_db_user:harshith123@cluster0.iq2r7fl.mongodb.net/" \
  --username mharshith200_db_user \
  --password harshith123

# In mongosh:
> use admin
> db.sessions.findOne({}, { sort: { _id: -1 } })
```

You should see your saved session with tabs, summary, and priming prompt.

## Done! 🎉

Your context is now saved to MongoDB and ready to use.

---

**Need help?** See:
- `GETTING_STARTED.txt` - Visual quick start
- `README.md` - Full documentation
- `DEMO.md` - Demo walkthrough
- `DEV_SETUP.md` - Development guide
