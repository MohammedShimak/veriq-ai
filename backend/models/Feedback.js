import mongoose from "mongoose";

const FeedbackSchema = new mongoose.Schema(
  {
    threadId: {
      type: String,
      required: true,
      index: true
    },
    turnIndex: {
      type: Number,
      required: true,
      min: 0
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    rating: {
      type: String,
      enum: ["up", "down"],
      required: true
    },
    comment: {
      type: String,
      default: "",
      maxlength: 500
    },
    category: {
      type: String,
      default: "",
      index: true
    },
    confidence: {
      type: Number,
      default: null
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index to prevent duplicate feedback from the same user on the same turn
FeedbackSchema.index({ threadId: 1, turnIndex: 1, userId: 1 }, { unique: true });

// Analytics performance indexes
FeedbackSchema.index({ threadId: 1, createdAt: -1 });
FeedbackSchema.index({ category: 1, rating: 1 });

export const Feedback = mongoose.model("Feedback", FeedbackSchema);
