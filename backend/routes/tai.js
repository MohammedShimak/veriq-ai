import express from "express";
import { optionalProtect } from "../middleware/authMiddleware.js";
import {
  synthesizeCaseState,
  executeWorkflowStep,
  TAI_ACTIONS
} from "../services/taiService.js";

const router = express.Router({ mergeParams: true });

/**
 * @route GET /api/investigation/:threadId/tai/plan
 * @desc Retrieves the structured TAI case plan and recommended next step.
 *       Enforces registered user ownership and cryptographic guest-token isolation.
 */
router.get("/plan", optionalProtect, async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    if (!threadId) {
      return res.status(400).json({ error: "threadId is required in URL path." });
    }

    const plan = await synthesizeCaseState(threadId, userId, guestToken);

    return res.status(200).json({
      success: true,
      plan
    });
  } catch (err) {
    if (err.statusCode === 401) {
      return res.status(401).json({ error: err.message });
    }
    if (err.statusCode === 403) {
      return res.status(403).json({ error: err.message });
    }
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    console.error("❌ Error fetching TAI plan:", err.message);
    return res.status(500).json({
      error: err.message || "Failed to synthesize TAI case plan."
    });
  }
});

/**
 * @route POST /api/investigation/:threadId/tai/step
 * @desc Executes a discrete workflow action under TAI coordination.
 *       Enforces server-side readiness gating, user ownership, and execution locking.
 */
router.post("/step", optionalProtect, async (req, res) => {
  try {
    const { threadId } = req.params;
    const { action, params } = req.body;
    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    if (!threadId) {
      return res.status(400).json({ error: "threadId is required in URL path." });
    }

    if (!action || typeof action !== "string") {
      return res.status(400).json({
        error: `Action is required. Supported actions: ${Object.values(TAI_ACTIONS).join(", ")}`
      });
    }

    const result = await executeWorkflowStep({
      threadId,
      action: action.trim(),
      params: params || {},
      userId,
      guestToken
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message });
    }
    if (err.statusCode === 401) {
      return res.status(401).json({ error: err.message });
    }
    if (err.statusCode === 403) {
      return res.status(403).json({ error: err.message });
    }
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    if (err.statusCode === 409) {
      return res.status(409).json({ error: err.message });
    }
    console.error("❌ Error executing TAI step:", err.message);
    return res.status(500).json({
      error: err.message || "Failed to execute TAI workflow step."
    });
  }
});

export default router;
