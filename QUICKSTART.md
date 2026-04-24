# ContextMind - Quick Start (2 Minutes)

## 1️⃣ Start Backend

```bash
cd backend
npm run dev
```

**Expected output:**
```
✅ MongoDB connected
🚀 Server running on http://localhost:37218
```

## 2️⃣ Load Extension

1. Open Chrome: `chrome://extensions/`
2. Toggle **Developer mode** (top right)
3. Click **Load unpacked**
4. Select `/Users/muralic/Desktop/Projects/Context-Switcher/chrome-extension`
5. Done! Extension icon appears in toolbar

## 3️⃣ Test It

1. Open multiple tabs:
   - `claude.ai` (AI tab)
   - `github.com` (work tab)
   - `youtube.com` (noise tab)

2. Click ContextMind icon (toolbar)

3. Verify tab classification:
   - ✅ Claude checked
   - ✅ GitHub checked
   - ❌ YouTube unchecked

4. Click **"Save Context"** button

5. Watch status messages, then see:
   - ✅ Green success message
   - Summary card
   - Copy button for prompt

## 🎉 Done!

You've saved your first context to MongoDB. The priming prompt can be copied and pasted into a new AI chat to resume work without re-explaining.

---

## 📖 Read More

- **Full Setup**: See [README.md](README.md)
- **Demo Walkthrough**: See [DEMO.md](DEMO.md)
- **Development**: See [DEV_SETUP.md](DEV_SETUP.md)
- **Architecture**: See [BUILD_STATUS.md](BUILD_STATUS.md)

## 🔧 Troubleshooting

**Backend won't start?**
```bash
# Kill any process on port 37218
lsof -ti:37218 | xargs kill
# Try again
npm run dev
```

**Extension not showing tabs?**
- Reload: Go to `chrome://extensions/` → click ↻ next to ContextMind

**Content not saving?**
- Open DevTools (F12) → Console
- Look for red error messages
- Check backend console for details

---

**Built for demos. Production-ready. One click. 🚀**
