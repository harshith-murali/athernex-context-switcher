import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./db.js";
import workspaceRouter from "./routes/workspace.js";
import saveRouter from "./routes/save.js";
import contextRouter from "./routes/context.js";
import localAuthRouter from "./routes/localAuth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 37218;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use((req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  (req as any).userId = token || "test-user";
  next();
});

app.use(workspaceRouter);
app.use(saveRouter);
app.use(contextRouter);
app.use(localAuthRouter);

app.get("/", (_req, res) => res.send("ContextMind backend running"));
app.get("/health", (_req, res) => res.json({ status: "ok" }));

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

start().catch(console.error);
