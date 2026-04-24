import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { Workspace } from "../db.js";

const router = Router();

router.post("/workspace/new", async (req, res) => {
  try {
    const { name } = req.body;
    const workspaceId = uuidv4();

    const workspace = new Workspace({
      workspaceId,
      userId: (req as any).userId,
      name: name?.trim() || "Unnamed Workspace",
      browserState: [],
      codeState:    [],
      chats: { messages: [], summary: { goal: "", decisions: [], constraints: [], progress: "", nextSteps: [] }, lastSummarizedIndex: 0 },
      lastUpdated: Date.now()
    });

    await workspace.save();
    console.log(`🆕 Workspace created: ${workspaceId}`);

    res.json({ workspaceId, name: workspace.name });
  } catch (err: any) {
    console.error("❌ Error creating workspace:", err);
    res.status(500).json({ error: "Failed to create workspace", details: err.message });
  }
});

export default router;
