import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./db.js";
import saveRouter from "./routes/save.js";
import contextRouter from "./routes/context.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 37218;

// Middleware
app.use(cors());
app.use(express.json());

// Mock Clerk middleware (replace with real Clerk in production)
app.use((req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  (req as any).userId = token || "test-user"; // For demo, use token as userId
  next();
});

// Routes
app.use(saveRouter);
app.use(contextRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

start().catch(console.error);
