import mongoose from "mongoose";

const browserEntrySchema = new mongoose.Schema({
  url:      { type: String, required: true },
  title:    { type: String, default: "" },
  content:  { type: String, default: "" },
  lastSeen: { type: Number, default: 0 }
}, { _id: false });

const codeEntrySchema = new mongoose.Schema({
  path:     { type: String, required: true },
  content:  { type: String, default: "" },
  language: { type: String, default: "unknown" },
  lastSeen: { type: Number, default: 0 }
}, { _id: false });

const messageSchema = new mongoose.Schema({
  role:      { type: String, required: true },
  content:   { type: String, required: true },
  timestamp: { type: Number, default: 0 }
}, { _id: false });

const summarySchema = new mongoose.Schema({
  goal:        { type: String, default: "" },
  decisions:   { type: [String], default: [] },
  constraints: { type: [String], default: [] },
  progress:    { type: String, default: "" },
  nextSteps:   { type: [String], default: [] }
}, { _id: false });

const chatSchema = new mongoose.Schema({
  messages:             { type: [messageSchema], default: [] },
  summary:              { type: summarySchema, default: () => ({}) },
  lastSummarizedIndex:  { type: Number, default: 0 }
}, { _id: false });

const workspaceSchema = new mongoose.Schema({
  workspaceId:  { type: String, required: true, unique: true },
  userId:       { type: String, required: true },
  name:         { type: String, default: "Unnamed Workspace" },
  browserState: { type: [browserEntrySchema], default: [] },
  codeState:    { type: [codeEntrySchema], default: [] },
  chats:        { type: chatSchema, default: () => ({}) },
  lastUpdated:  { type: Number, default: 0 }
}, { timestamps: true });

workspaceSchema.index({ workspaceId: 1, userId: 1 });

export const Workspace = mongoose.model("workspaces", workspaceSchema);

export async function connectDB() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) throw new Error("MONGO_URI not provided");
    await mongoose.connect(mongoUri);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  }
}
