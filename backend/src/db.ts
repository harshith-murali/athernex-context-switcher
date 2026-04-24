import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  timestamp: { type: Number, required: true },
  userId: { type: String, required: true },

  chromePayload: {
    windowId: String,
    tabsCount: Number
  },

  userSummary: String,
  primingPrompt: String,

  tabs: [{
    url: String,
    title: String,
    content: String,
    sourceType: { type: String, enum: ["ai", "mcp", "raw"] }
  }]
}, { timestamps: true });

export const Session = mongoose.model("sessions", sessionSchema);

export async function connectDB() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI not provided");
    }

    await mongoose.connect(mongoUri);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  }
}
