import crypto from "crypto";
import mongoose from "mongoose";
import {
  createInvestigation,
  getThread,
  updateStage,
  saveTurn,
  hashGuestToken,
  verifyUserOwnership,
  sanitizeStageMetadata
} from "../services/threadService.js";
import { INVESTIGATION_STAGES } from "../models/Thread.js";
import investigationRouter from "../routes/investigation.js";
import exportRouter from "../routes/export.js";
import adminRouter from "../routes/admin.js";
import debateRouter from "../routes/debate.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

/**
 * Mock response helper for route handlers
 */
function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.data = body;
      return this;
    },
    setHeader(key, val) {
      this.headers[key.toLowerCase()] = val;
    },
    pipe(dest) {
      return dest;
    },
    end() {
      this.headersSent = true;
    }
  };
  return res;
}

/**
 * Executes router-level middleware and matched route handlers in sequence
 */
async function executeRouter(router, path, method, req, res) {
  if (!req.ip) req.ip = "127.0.0.1";
  if (!req.app) req.app = { get: () => false };
  const matchedHandlers = [];
  for (const layer of router.stack) {
    if (!layer.route) {
      // Router-level middleware (e.g., router.use(protect, adminOnly))
      if (layer.handle) {
        matchedHandlers.push(layer.handle);
      }
    } else if (layer.route.path === path && layer.route.methods[method.toLowerCase()]) {
      matchedHandlers.push(...layer.route.stack.map((s) => s.handle));
    }
  }

  if (matchedHandlers.length === 0) {
    throw new Error(`Handler not found for ${method} ${path}`);
  }

  let idx = 0;
  const next = async (err) => {
    if (err) throw err;
    if (idx < matchedHandlers.length) {
      const handler = matchedHandlers[idx++];
      await handler(req, res, next);
    }
  };
  await next();
  return res;
}

describe("Security Remediation Round 2 Tests", () => {
  const userA = new mongoose.Types.ObjectId().toString();
  const userB = new mongoose.Types.ObjectId().toString();
  const adminUser = {
    _id: new mongoose.Types.ObjectId().toString(),
    role: "admin",
    name: "System Admin",
    email: "admin@needhiai.gov.in"
  };
  const ordinaryUser = {
    _id: new mongoose.Types.ObjectId().toString(),
    role: "user",
    name: "Ordinary Consumer",
    email: "consumer@example.com"
  };

  // =========================================================================
  // 1. Guest Investigation Access Control
  // =========================================================================
  describe("1. Guest Investigation Access Control", () => {
    test("1.1 Guest case creation issues a cryptographically secure 64-char hex token", async () => {
      const threadId = `guest_sec_${Date.now()}_1`;
      const created = await createInvestigation({
        threadId,
        complaint: "Guest dispute regarding defective smartwatch battery.",
        generateGuestToken: true
      });

      expect(created.guestToken).toBeDefined();
      expect(typeof created.guestToken).toBe("string");
      expect(created.guestToken.length).toBe(64); // 32 bytes hex = 64 chars
    });

    test("1.2 Only the SHA-256 hash of the guest token is stored in the database", async () => {
      const threadId = `guest_sec_${Date.now()}_2`;
      const created = await createInvestigation({
        threadId,
        complaint: "Dispute about delayed flight refund.",
        generateGuestToken: true
      });

      const rawToken = created.guestToken;
      const expectedHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      // Verify the in-memory/DB representation holds the hash, not the raw token
      expect(created.guestTokenHash).toBe(expectedHash);
      expect(created.guestTokenHash).not.toBe(rawToken);
    });

    test("1.3 Valid guest token authorizes read and modification", async () => {
      const threadId = `guest_sec_${Date.now()}_3`;
      const created = await createInvestigation({
        threadId,
        complaint: "E-commerce order never delivered.",
        generateGuestToken: true
      });
      const guestToken = created.guestToken;

      const retrieved = await getThread(threadId, null, guestToken);
      expect(retrieved).not.toBeNull();
      expect(retrieved.threadId).toBe(threadId);

      // Verify modification with guest token succeeds
      const updated = await updateStage(
        threadId,
        INVESTIGATION_STAGES.AWAITING_CLARIFICATION,
        {},
        null,
        guestToken
      );
      expect(updated.stage).toBe(INVESTIGATION_STAGES.AWAITING_CLARIFICATION);
    });

    test("1.4 Access to guest case without guest token is rejected with 401", async () => {
      const threadId = `guest_sec_${Date.now()}_4`;
      await createInvestigation({
        threadId,
        complaint: "Restaurant charged hidden service charge.",
        generateGuestToken: true
      });

      let err = null;
      try {
        await getThread(threadId, null, null);
      } catch (e) {
        err = e;
      }
      expect(err).not.toBeNull();
      expect(err.statusCode).toBe(401);
      expect(err.message).toContain("Guest authorization required: Missing guest access token.");
    });

    test("1.5 Access to guest case with invalid guest token is rejected with 403", async () => {
      const threadId = `guest_sec_${Date.now()}_5`;
      await createInvestigation({
        threadId,
        complaint: "Gym membership refund refusal.",
        generateGuestToken: true
      });

      let err = null;
      try {
        await getThread(threadId, null, "invalid_tampered_guest_token_1234567890abcdef");
      } catch (e) {
        err = e;
      }
      expect(err).not.toBeNull();
      expect(err.statusCode).toBe(403);
      expect(err.message).toContain("Access denied: Invalid guest access token.");
    });

    test("1.6 Cross-case guest token (Token A attempting to read Case B) is rejected with 403", async () => {
      const threadA = `guest_sec_${Date.now()}_6A`;
      const threadB = `guest_sec_${Date.now()}_6B`;

      const caseA = await createInvestigation({
        threadId: threadA,
        complaint: "Complaint Case A",
        generateGuestToken: true
      });
      await createInvestigation({
        threadId: threadB,
        complaint: "Complaint Case B",
        generateGuestToken: true
      });

      // Try reading Case B with Case A's token
      let err = null;
      try {
        await getThread(threadB, null, caseA.guestToken);
      } catch (e) {
        err = e;
      }
      expect(err).not.toBeNull();
      expect(err.statusCode).toBe(403);
      expect(err.message).toContain("Access denied: Invalid guest access token.");
    });

    test("1.7 Guest token cannot access a registered user's private investigation (401/403)", async () => {
      const threadId = `guest_sec_${Date.now()}_7`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Registered user confidential dispute."
      });

      const randomGuestToken = crypto.randomBytes(32).toString("hex");

      let err = null;
      try {
        await getThread(threadId, null, randomGuestToken);
      } catch (e) {
        err = e;
      }
      expect(err).not.toBeNull();
      expect(err.statusCode).toBe(401);
      expect(err.message).toContain("Authentication required: This investigation is private to a registered user.");
    });

    test("1.8 Route GET /api/investigation/:threadId with x-guest-token authorizes guest and rejects unauthenticated caller", async () => {
      const threadId = `guest_sec_${Date.now()}_8`;
      const created = await createInvestigation({
        threadId,
        complaint: "Faulty washing machine repair dispute.",
        generateGuestToken: true
      });

      // Request without x-guest-token header -> 401
      const reqMissing = {
        params: { threadId },
        headers: {},
        user: null
      };
      const resMissing = createMockRes();
      await executeRouter(investigationRouter, "/:threadId", "GET", reqMissing, resMissing);
      expect(resMissing.statusCode).toBe(401);

      // Request with valid x-guest-token header -> 200
      const reqValid = {
        params: { threadId },
        headers: { "x-guest-token": created.guestToken },
        user: null
      };
      const resValid = createMockRes();
      await executeRouter(investigationRouter, "/:threadId", "GET", reqValid, resValid);
      expect(resValid.statusCode).toBe(200);
      expect(resValid.data.investigation.threadId).toBe(threadId);
    });
  });

  // =========================================================================
  // 2. Secure Export Endpoints
  // =========================================================================
  describe("2. Secure Export Endpoints", () => {
    test("2.1 GET /api/export/pdf/:threadId returns 401 when unauthenticated caller requests registered user PDF", async () => {
      const threadId = `export_sec_${Date.now()}_1`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Private export test dispute."
      });

      const req = {
        params: { threadId },
        headers: {},
        user: null
      };
      const res = createMockRes();
      await executeRouter(exportRouter, "/pdf/:threadId", "GET", req, res);

      expect(res.statusCode).toBe(401);
      expect(res.data.error).toContain("Authentication required");
    });

    test("2.2 GET /api/export/pdf/:threadId returns 403 when User B requests User A's PDF", async () => {
      const threadId = `export_sec_${Date.now()}_2`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Private export test dispute."
      });

      const req = {
        params: { threadId },
        headers: {},
        user: { _id: userB }
      };
      const res = createMockRes();
      await executeRouter(exportRouter, "/pdf/:threadId", "GET", req, res);

      expect(res.statusCode).toBe(403);
      expect(res.data.error).toContain("Access denied");
    });

    test("2.3 GET /api/export/pdf/:threadId returns 401 when guest PDF is requested without guest token", async () => {
      const threadId = `export_sec_${Date.now()}_3`;
      await createInvestigation({
        threadId,
        complaint: "Guest export test dispute.",
        generateGuestToken: true
      });

      const req = {
        params: { threadId },
        headers: {},
        user: null
      };
      const res = createMockRes();
      await executeRouter(exportRouter, "/pdf/:threadId", "GET", req, res);

      expect(res.statusCode).toBe(401);
      expect(res.data.error).toContain("Guest authorization required");
    });

    test("2.4 GET /api/export/citation-graph/:threadId returns 401 when unauthenticated caller requests registered user graph", async () => {
      const threadId = `export_sec_${Date.now()}_4`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Confidential legal graph test."
      });

      const req = {
        params: { threadId },
        headers: {},
        user: null
      };
      const res = createMockRes();
      await executeRouter(exportRouter, "/citation-graph/:threadId", "GET", req, res);

      expect(res.statusCode).toBe(401);
      expect(res.data.error).toContain("Authentication required");
    });

    test("2.5 GET /api/export/citation-graph/:threadId returns 403 when User B requests User A's citation graph", async () => {
      const threadId = `export_sec_${Date.now()}_5`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Confidential legal graph test."
      });

      const req = {
        params: { threadId },
        headers: {},
        user: { _id: userB }
      };
      const res = createMockRes();
      await executeRouter(exportRouter, "/citation-graph/:threadId", "GET", req, res);

      expect(res.statusCode).toBe(403);
      expect(res.data.error).toContain("Access denied");
    });

    test("2.6 GET /api/export/citation-graph/:threadId succeeds (200) for valid owner", async () => {
      const threadId = `export_sec_${Date.now()}_6`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Authorized owner legal graph test."
      });

      const req = {
        params: { threadId },
        headers: {},
        user: { _id: userA }
      };
      const res = createMockRes();
      await executeRouter(exportRouter, "/citation-graph/:threadId", "GET", req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.nodes).toBeDefined();
      expect(res.data.edges).toBeDefined();
      expect(Array.isArray(res.data.nodes)).toBe(true);
    });

    test("2.7 GET /api/export/citation-graph/:threadId succeeds (200) for authorized guest with x-guest-token", async () => {
      const threadId = `export_sec_${Date.now()}_7`;
      const created = await createInvestigation({
        threadId,
        complaint: "Authorized guest citation graph test.",
        generateGuestToken: true
      });

      const req = {
        params: { threadId },
        headers: { "x-guest-token": created.guestToken },
        user: null
      };
      const res = createMockRes();
      await executeRouter(exportRouter, "/citation-graph/:threadId", "GET", req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.nodes).toBeDefined();
      expect(Array.isArray(res.data.nodes)).toBe(true);
    });
  });

  // =========================================================================
  // 3. Secure Administrator Endpoints
  // =========================================================================
  describe("3. Secure Administrator Endpoints", () => {
    test("3.1 Unauthenticated caller to protect middleware returns 401", async () => {
      const req = { headers: {} };
      const res = createMockRes();
      let nextCalled = false;

      await protect(req, res, () => { nextCalled = true; });

      expect(res.statusCode).toBe(401);
      expect(res.data.error).toContain("Authentication required");
      expect(nextCalled).toBe(false);
    });

    test("3.2 Ordinary user (role: 'user') accessing adminOnly middleware is rejected with 403", () => {
      const req = { user: ordinaryUser };
      const res = createMockRes();
      let nextCalled = false;

      adminOnly(req, res, () => { nextCalled = true; });

      expect(res.statusCode).toBe(403);
      expect(res.data.error).toBe("Admin access required.");
      expect(nextCalled).toBe(false);
    });

    test("3.3 Admin user (role: 'admin') passes adminOnly middleware successfully", () => {
      const req = { user: adminUser };
      const res = createMockRes();
      let nextCalled = false;

      adminOnly(req, res, () => { nextCalled = true; });

      expect(nextCalled).toBe(true);
      expect(res.statusCode).toBe(200);
    });

    test("3.4 adminRouter enforces protect and adminOnly at the router level", async () => {
      // Unauthenticated request to /stats/overview
      const reqUnauth = { headers: {} };
      const resUnauth = createMockRes();

      await executeRouter(adminRouter, "/stats/overview", "GET", reqUnauth, resUnauth);
      expect(resUnauth.statusCode).toBe(401);
      expect(resUnauth.data.error).toContain("Authentication required");

      // Ordinary user request through adminOnly
      const reqOrdinary = { headers: {}, user: ordinaryUser };
      const resOrdinary = createMockRes();

      adminOnly(reqOrdinary, resOrdinary, () => {});
      expect(resOrdinary.statusCode).toBe(403);
      expect(resOrdinary.data.error).toBe("Admin access required.");
    });
  });

  // =========================================================================
  // 4. Prevent Legacy Debate Workflow Bypass
  // =========================================================================
  describe("4. Prevent Legacy Debate Workflow Bypass", () => {
    test("4.1 Calling POST /api/debate on an in-progress investigation (INITIAL_ANALYSIS) returns 400", async () => {
      const threadId = `debate_sec_${Date.now()}_1`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Active dispute that has not undergone clarification or evidence collection."
      });

      const req = {
        body: {
          threadId,
          question: "Run full debate and produce verdict immediately."
        },
        headers: {},
        user: { _id: userA }
      };
      const res = createMockRes();

      await executeRouter(debateRouter, "/", "POST", req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.error).toContain("State bypass rejected");
      expect(res.data.error).toContain("INITIAL_ANALYSIS");
    });

    test("4.2 Calling POST /api/debate on an in-progress investigation in AWAITING_CLARIFICATION returns 400", async () => {
      const threadId = `debate_sec_${Date.now()}_2`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Active dispute awaiting clarification answers."
      });
      await updateStage(threadId, INVESTIGATION_STAGES.AWAITING_CLARIFICATION, userA);

      const req = {
        body: {
          threadId,
          question: "Bypass question answers and run debate."
        },
        headers: {},
        user: { _id: userA }
      };
      const res = createMockRes();

      await executeRouter(debateRouter, "/", "POST", req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.error).toContain("State bypass rejected");
      expect(res.data.error).toContain("AWAITING_CLARIFICATION");
    });

    test("4.3 Calling POST /api/debate on an in-progress investigation in AWAITING_EVIDENCE returns 400", async () => {
      const threadId = `debate_sec_${Date.now()}_3`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Active dispute in evidence stage."
      });
      await updateStage(threadId, INVESTIGATION_STAGES.AWAITING_CLARIFICATION, userA);
      await updateStage(threadId, INVESTIGATION_STAGES.AWAITING_EVIDENCE, userA);

      const req = {
        body: {
          threadId,
          question: "Bypass evidence upload and generate verdict."
        },
        headers: {},
        user: { _id: userA }
      };
      const res = createMockRes();

      await executeRouter(debateRouter, "/", "POST", req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.error).toContain("State bypass rejected");
      expect(res.data.error).toContain("AWAITING_EVIDENCE");
    });

    test("4.4 saveTurn() on an in-progress investigation preserves its stage and does NOT jump to ASSESSMENT_COMPLETE", async () => {
      const threadId = `debate_sec_${Date.now()}_4`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Active investigation preserving state."
      });
      await updateStage(threadId, INVESTIGATION_STAGES.AWAITING_CLARIFICATION, userA);

      // Attempt to invoke saveTurn with a complete judge verdict
      await saveTurn(
        threadId,
        {
          question: "Test question",
          retrievedContext: "Sec 2(10)",
          support: { argument: "Valid" },
          oppose: { argument: "Invalid" },
          judge: { verdict: "Consumer Wins", overall_confidence: 90 }
        },
        userA
      );

      const thread = await getThread(threadId, userA);
      // Stage MUST NOT be ASSESSMENT_COMPLETE
      expect(thread.stage).toBe(INVESTIGATION_STAGES.AWAITING_CLARIFICATION);
      expect(thread.stage).not.toBe(INVESTIGATION_STAGES.ASSESSMENT_COMPLETE);
    });
  });

  // =========================================================================
  // 5. Missing Negative Tests
  // =========================================================================
  describe("5. Missing Negative Security Tests", () => {
    test("5.1 POST /api/investigation/:threadId/analyze returns 401 when unauthenticated caller accesses owned investigation", async () => {
      const threadId = `neg_sec_${Date.now()}_1`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Private consumer dispute."
      });

      const req = {
        params: { threadId },
        headers: {},
        user: null
      };
      const res = createMockRes();

      await executeRouter(investigationRouter, "/:threadId/analyze", "POST", req, res);

      expect(res.statusCode).toBe(401);
      expect(res.data.error).toContain("Authentication required");
    });

    test("5.2 POST /api/investigation/:threadId/answers returns 401 when unauthenticated caller accesses owned investigation", async () => {
      const threadId = `neg_sec_${Date.now()}_2`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Private consumer dispute."
      });

      const req = {
        params: { threadId },
        headers: {},
        user: null,
        body: { answers: [{ questionId: "q1", answer: "Answer" }] }
      };
      const res = createMockRes();

      await executeRouter(investigationRouter, "/:threadId/answers", "POST", req, res);

      expect(res.statusCode).toBe(401);
      expect(res.data.error).toContain("Authentication required");
    });

    test("5.3 POST /api/investigation/:threadId/proceed returns 401 when unauthenticated caller accesses owned investigation", async () => {
      const threadId = `neg_sec_${Date.now()}_3`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Private consumer dispute."
      });

      const req = {
        params: { threadId },
        headers: {},
        user: null
      };
      const res = createMockRes();

      await executeRouter(investigationRouter, "/:threadId/proceed", "POST", req, res);

      expect(res.statusCode).toBe(401);
      expect(res.data.error).toContain("Authentication required");
    });

    test("5.4 PATCH /api/investigation/:threadId/stage returns 401 when unauthenticated caller accesses owned investigation", async () => {
      const threadId = `neg_sec_${Date.now()}_4`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Private consumer dispute."
      });

      const req = {
        params: { threadId },
        headers: {},
        user: null,
        body: { stage: INVESTIGATION_STAGES.AWAITING_CLARIFICATION }
      };
      const res = createMockRes();

      await executeRouter(investigationRouter, "/:threadId/stage", "PATCH", req, res);

      expect(res.statusCode).toBe(401);
      expect(res.data.error).toContain("Authentication required");
    });

    test("5.5 Dot-notation metadata injection is rejected with 400", () => {
      expect(() => {
        sanitizeStageMetadata({
          "assessment.status": "COMPLETED",
          "userId": userB
        });
      }).toThrow(/Unsupported metadata field|Modification of protected internal field/);

      expect(() => {
        sanitizeStageMetadata({
          "intake.product": "Manipulated Product"
        });
      }).toThrow(/Unsupported metadata field|Modification of protected internal field/);
    });

    test("5.6 Direct client transition to ASSESSMENT_COMPLETE via /stage is rejected with 400", async () => {
      const threadId = `neg_sec_${Date.now()}_5`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Client attempting to mark case as assessed."
      });

      const req = {
        params: { threadId },
        headers: {},
        user: { _id: userA },
        body: { stage: INVESTIGATION_STAGES.ASSESSMENT_COMPLETE }
      };
      const res = createMockRes();

      await executeRouter(investigationRouter, "/:threadId/stage", "PATCH", req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.error).toContain("Direct client transition to stage \"ASSESSMENT_COMPLETE\" is prohibited");
    });
  });
});
