import { Router } from "express";
import fs from "fs";
import os from "os";
import path from "path";
import { Workspace } from "../db.js";

const router = Router();
const AUTH_FILE = path.join(os.homedir(), ".contextmind_auth.json");

// Save the active user ID from the Chrome extension
router.post("/local/auth", (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ userId, syncedAt: Date.now() }));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to write auth file", details: err.message });
  }
});

// Provide workspaces to VS Code
router.get("/local/workspaces", async (req, res) => {
  try {
    if (!fs.existsSync(AUTH_FILE)) {
      return res.status(401).json({ error: "Not synced", message: "Please open the Chrome extension to sync your account." });
    }

    const { userId } = JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
    const workspaces = await Workspace
      .find({ userId }, { workspaceId: 1, name: 1, lastUpdated: 1 })
      .sort({ lastUpdated: -1 })
      .lean();

    res.json({ workspaces });
  } catch (err: any) {
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

export default router;
