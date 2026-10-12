import express from "express";
import { Feedback } from "../models/Feedback.js";
import { Thread } from "../models/Thread.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * POST /api/feedback
 * Submit or update user feedback (thumbs up/down + optional comment) on a case turn.
 */
router.post("/", protect, async (req, res) => {
  try {
    const { threadId, turnIndex, rating, comment } = req.body;

    if (!threadId || typeof threadId !== "string" || !threadId.trim()) {
      return res.status(400).json({ error: "Valid threadId is required." });
    }

    if (typeof turnIndex !== "number" || turnIndex < 0 || !Number.isInteger(turnIndex)) {
      return res.status(400).json({ error: "Invalid turn index." });
    }

    let normRating = rating;
    if (normRating === "thumbs_up") normRating = "up";
    if (normRating === "thumbs_down") normRating = "down";

    if (!normRating || !["up", "down"].includes(normRating)) {
      return res.status(400).json({ error: "Rating must be 'up' or 'down'." });
    }

    if (comment && typeof comment === "string" && comment.length > 500) {
      return res.status(400).json({ error: "Comment cannot exceed 500 characters." });
    }

    const effectiveThreadId = (threadId && typeof threadId === "string" && threadId.trim()) ? threadId.trim() : "general";
    const effectiveTurnIndex = (typeof turnIndex === "number" && turnIndex >= 0) ? turnIndex : 0;

    let category = "General Platform Feedback";
    let confidence = 1.0;

    if (effectiveThreadId !== "general" && effectiveThreadId !== "global") {
      const thread = await Thread.findOne({ threadId: effectiveThreadId });
      if (thread && thread.turns && effectiveTurnIndex < thread.turns.length) {
        const targetTurn = thread.turns[effectiveTurnIndex];
        category = targetTurn.category || thread.category || "General Consumer Law";
        confidence = targetTurn.judgeConfidence !== undefined && targetTurn.judgeConfidence !== null
          ? targetTurn.judgeConfidence
          : targetTurn.judge?.overall_confidence || 0.70;
      }
    }

    const filter = { threadId: effectiveThreadId, turnIndex: effectiveTurnIndex, userId: req.user._id };
    const update = {
      rating: normRating,
      comment: (comment || "").trim(),
      category,
      confidence
    };

    const feedbackDoc = await Feedback.findOneAndUpdate(
      filter,
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json({
      message: "Feedback submitted.",
      feedback: feedbackDoc
    });
  } catch (err) {
    console.error("⚠️ Error submitting feedback:", err.message);
    return res.status(500).json({ error: "Server error submitting feedback." });
  }
});

/**
 * GET /api/feedback/stats/summary
 * Aggregate global & per-category feedback analytics for admin users.
 */
router.get("/stats/summary", protect, adminOnly, async (req, res) => {
  try {
    const globalAgg = await Feedback.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          up: { $sum: { $cond: [{ $eq: ["$rating", "up"] }, 1, 0] } },
          down: { $sum: { $cond: [{ $eq: ["$rating", "down"] }, 1, 0] } }
        }
      }
    ]);

    const globalStats = globalAgg[0] || { total: 0, up: 0, down: 0 };
    const globalApprovalRatio = globalStats.total > 0
      ? Number((globalStats.up / globalStats.total).toFixed(4))
      : 0;

    const categoryAgg = await Feedback.aggregate([
      {
        $group: {
          _id: "$category",
          total: { $sum: 1 },
          up: { $sum: { $cond: [{ $eq: ["$rating", "up"] }, 1, 0] } },
          down: { $sum: { $cond: [{ $eq: ["$rating", "down"] }, 1, 0] } }
        }
      },
      {
        $project: {
          category: "$_id",
          total: 1,
          up: 1,
          down: 1,
          approvalRatio: {
            $cond: [
              { $gt: ["$total", 0] },
              { $round: [{ $divide: ["$up", "$total"] }, 4] },
              0
            ]
          }
        }
      }
    ]);

    return res.status(200).json({
      global: {
        ...globalStats,
        approvalRatio: globalApprovalRatio
      },
      byCategory: categoryAgg
    });
  } catch (err) {
    console.error("⚠️ Error calculating feedback summary:", err.message);
    return res.status(500).json({ error: "Server error calculating feedback summary." });
  }
});

/**
 * GET /api/feedback/stats/confidence-correlation
 * Bucketed confidence scores vs approval ratio correlation for admin users.
 */
router.get("/stats/confidence-correlation", protect, adminOnly, async (req, res) => {
  try {
    const correlationAgg = await Feedback.aggregate([
      {
        $bucket: {
          groupBy: "$confidence",
          boundaries: [0.0, 0.3, 0.5, 0.7, 0.9, 1.01],
          default: "unknown",
          output: {
            total: { $sum: 1 },
            up: { $sum: { $cond: [{ $eq: ["$rating", "up"] }, 1, 0] } },
            down: { $sum: { $cond: [{ $eq: ["$rating", "down"] }, 1, 0] } }
          }
        }
      }
    ]);

    const rangeLabels = {
      0: "0.0-0.3",
      0.3: "0.3-0.5",
      0.5: "0.5-0.7",
      0.7: "0.7-0.9",
      0.9: "0.9-1.0"
    };

    const correlationBuckets = correlationAgg.map((bucket) => {
      const label = rangeLabels[bucket._id] || String(bucket._id);
      const approvalRatio = bucket.total > 0 ? Number((bucket.up / bucket.total).toFixed(4)) : 0;
      return {
        range: label,
        total: bucket.total,
        up: bucket.up,
        down: bucket.down,
        approvalRatio
      };
    });

    return res.status(200).json({ correlationBuckets });
  } catch (err) {
    console.error("⚠️ Error calculating confidence correlation:", err.message);
    return res.status(500).json({ error: "Server error calculating confidence correlation." });
  }
});

/**
 * GET /api/feedback/:threadId
 * Get all user feedback records for a specific case thread.
 */
router.get("/:threadId", protect, async (req, res) => {
  try {
    const { threadId } = req.params;
    const feedbackList = await Feedback.find({ threadId }).lean();
    return res.status(200).json({ feedback: feedbackList });
  } catch (err) {
    console.error("⚠️ Error fetching thread feedback:", err.message);
    return res.status(500).json({ error: "Server error fetching thread feedback." });
  }
});

export default router;
