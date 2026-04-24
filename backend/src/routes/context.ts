import { Router } from "express";
import { Session } from "../db.js";

const router = Router();

router.get("/context", async (req, res) => {
  try {
    const userId = (req as any).userId;

    const session = await Session.findOne({ userId })
      .sort({ timestamp: -1 });

    if (!session) {
      return res.status(404).json({ error: "No context found" });
    }

    res.json({
      sessionId: session.sessionId,
      userSummary: session.userSummary,
      primingPrompt: session.primingPrompt,
      tabs: session.tabs,
      timestamp: session.timestamp
    });
  } catch (err) {
    console.error("Context fetch error:", err);
    res.status(500).json({ error: "Failed to fetch context" });
  }
});

export default router;
