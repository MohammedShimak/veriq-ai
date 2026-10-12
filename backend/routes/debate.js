import express from "express";
import crypto from "crypto";
import { runDebate } from "../services/orchestrator.js";
import { getThread, saveTurn } from "../services/threadService.js";
import { optionalProtect } from "../middleware/authMiddleware.js";
import { debateRateLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

router.post("/", optionalProtect, debateRateLimiter, async (req, res) => {
  try {
    const { question, threadId: reqThreadId, product, company, amount } = req.body;

    if (!question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({
        error: "Question is required and must be a non-empty string."
      });
    }

    // Assign or reuse threadId
    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    // Direct debate verdict generation without an investigation case is rejected to enforce gate
    if (!reqThreadId) {
      return res.status(400).json({
        error: "Direct debate bypass rejected: Consumer disputes must be initiated through the investigation workflow (/api/investigation) before seeking adjudication to ensure clarification and evidence gate compliance."
      });
    }

    const activeThreadId = reqThreadId;

    // If an existing threadId is requested, enforce authorization and block in-progress/incomplete investigations
    let existingThread = null;
    try {
      existingThread = await getThread(reqThreadId, userId, guestToken);
    } catch (authErr) {
      if (authErr.statusCode === 401 || authErr.statusCode === 403) {
        return res.status(authErr.statusCode).json({ error: authErr.message });
      }
    }

    if (!existingThread) {
      return res.status(404).json({
        error: `Investigation with threadId "${reqThreadId}" not found.`
      });
    }

    if (existingThread && existingThread.stage) {
      const IN_PROGRESS_INVESTIGATION_STAGES = [
        "INITIAL_ANALYSIS",
        "AWAITING_CLARIFICATION",
        "AWAITING_EVIDENCE",
        "EVIDENCE_REVIEW"
      ];
      if (IN_PROGRESS_INVESTIGATION_STAGES.includes(existingThread.stage)) {
        return res.status(400).json({
          error: `State bypass rejected: Cannot invoke legacy debate workflow on an active investigation in stage "${existingThread.stage}". Follow the required clarification and evidence collection stages.`
        });
      }
    }

    // Check completeness gate status
    if (existingThread && existingThread.investigationGate) {
      const gateStatus = existingThread.investigationGate.status;
      const isGateSatisfied = Boolean(
        existingThread.investigationGate.isSatisfied ||
        gateStatus === "READY" ||
        gateStatus === "PROCEED_WITH_LIMITATIONS"
      );

      if (!isGateSatisfied || gateStatus === "INCOMPLETE") {
        return res.status(400).json({
          error: `Gate bypass rejected: Cannot generate case adjudication when the investigation completeness gate is INCOMPLETE (current gate status: "${gateStatus || "NOT_EVALUATED"}"). Please answer pending questions and provide supporting evidence.`
        });
      }
    }

    // Set Server-Sent Event (SSE) and CORS headers
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const sendEvent = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // 1. Send thread event first
    sendEvent("thread", { threadId: activeThreadId });

    // 2. Load prior thread history if existing threadId provided
    const history = existingThread && Array.isArray(existingThread.turns)
      ? existingThread.turns.slice(-3)
      : [];

    if (history.length > 0) {
      console.log(`📜 Loaded ${history.length} prior turns for threadId "${activeThreadId}"`);
    }

    // 3. Execute debate with conversation history
    const result = await runDebate(
      question,
      "",
      (event, data) => sendEvent(event, data),
      history
    );

    // 4. Save new turn to MongoDB / Thread Service with userId association
    if (result && !result.outOfScope && result.support && result.oppose && result.judge) {
      const category = (result.caseRepresentation && result.caseRepresentation.product_or_service) || "";
      await saveTurn(activeThreadId, {
        question,
        retrievedContext: result.retrievedContext || "",
        support: result.support,
        oppose: result.oppose,
        judge: result.judge
      }, userId, category, { product, company, amount, complaint: question }, guestToken);
      console.log(`💾 Turn saved successfully to thread "${activeThreadId}" for ${userId ? `user "${userId}"` : "guest user"}`);
    }

    res.end();
  } catch (error) {
    console.error("⚠️ Error in SSE Debate route:", error.message);
    try {
      res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`);
      res.end();
    } catch (e) {
      // stream closed
    }
  }
});

export default router;