import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import debateRoute from "./routes/debate.js";
import authRoute from "./routes/auth.js";
import historyRoute from "./routes/history.js";
import feedbackRoute from "./routes/feedback.js";
import exportRoute from "./routes/export.js";
import adminRoute from "./routes/admin.js";
import investigationRoute from "./routes/investigation.js";
import helpHubRoute from "./routes/helpHub.js";
import { globalRateLimiter } from "./middleware/rateLimiter.js";
import { connectDB } from "./config/db.js";
import { isLiveEnabled } from "./services/indianKanoon.js";

dotenv.config();

if (!isLiveEnabled()) {
  console.warn("⚠️ INDIAN_KANOON_API_TOKEN not set: live Indian law search disabled, using local CPA 2019 index only.");
}

const app = express();

// Apply Global API Rate Limiter
app.use(globalRateLimiter);

// Enable CORS globally for all origins, methods, and headers
app.use(cors({
  origin: true, // Reflect request origin
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "x-guest-token", "X-Guest-Token"]
}));

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Initialize MongoDB connection
connectDB();

app.get("/", (req, res) => {
  res.send("NeedhiAI (நீதி) Backend Running 🚀");
});

app.get("/api/status", (req, res) => {
  res.json({ status: "ok", live_law: isLiveEnabled() });
});

// Mount Authentication, History, Feedback, Export, Admin, Debate & Help Hub Routes
app.use("/api/auth", authRoute);
app.use("/api/history", historyRoute);
app.use("/api/feedback", feedbackRoute);
app.use("/api/export", exportRoute);
app.use("/api/admin", adminRoute);
app.use("/api/debate", debateRoute);
app.use("/api/investigation", investigationRoute);
app.use("/api/help-hub", helpHubRoute);

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT} and http://127.0.0.1:${PORT}`);
});