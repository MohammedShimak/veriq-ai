import {
  createInvestigation,
  getThread,
  updateStage,
  saveClarificationResponse,
  submitClarificationAnswers,
  advanceInvestigationRound,
  sanitizeStageMetadata,
  verifyUserOwnership,
  ALLOWED_STAGE_METADATA_FIELDS,
  PROTECTED_INTERNAL_FIELDS
} from "../services/threadService.js";
import { INVESTIGATION_STAGES, ALLOWED_STAGE_TRANSITIONS } from "../models/Thread.js";
import investigationRouter from "../routes/investigation.js";
import mongoose from "mongoose";

/**
 * Helper to invoke Express route handlers in isolation with mocked req and res
 */
function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.data = body;
      return this;
    },
    setHeader(key, val) {
      this.headers[key] = val;
    }
  };
  return res;
}

function findRouteHandler(router, path, method) {
  for (const layer of router.stack) {
    if (layer.route && layer.route.path === path && layer.route.methods[method.toLowerCase()]) {
      const handlers = layer.route.stack.map((s) => s.handle);
      return handlers;
    }
  }
  return null;
}

async function executeRoute(router, path, method, req, res) {
  const handlers = findRouteHandler(router, path, method);
  if (!handlers) throw new Error(`Handler not found for ${method} ${path}`);
  let index = 0;
  const next = async (err) => {
    if (err) throw err;
    index++;
    if (index < handlers.length) {
      await handlers[index](req, res, next);
    }
  };
  await handlers[0](req, res, next);
  return res;
}

describe("P0 Critical Security Remediation Tests", () => {
  const userA = new mongoose.Types.ObjectId().toString();
  const userB = new mongoose.Types.ObjectId().toString();

  // =========================================================================
  // P0-1: Authentication and Ownership
  // =========================================================================
  describe("P0-1: Authentication and Ownership Verification", () => {
    test("1. Unauthenticated caller cannot read a registered user's private investigation (401)", async () => {
      const threadId = `p0_1_owned_${Date.now()}_1`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Medical negligence case involving sensitive patient health records."
      });

      // Calling getThread with no userId (unauthenticated) must throw 401
      let caughtError = null;
      try {
        await getThread(threadId, null);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError.statusCode).toBe(401);
      expect(caughtError.message).toContain("Authentication required");
    });

    test("2. User B cannot read User A's private investigation (403)", async () => {
      const threadId = `p0_1_owned_${Date.now()}_2`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Private consumer dispute regarding bank credit card charges."
      });

      // User B calling getThread must throw 403
      let caughtError = null;
      try {
        await getThread(threadId, userB);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError.statusCode).toBe(403);
      expect(caughtError.message).toContain("Access denied: You do not own this investigation case.");
    });

    test("3. User B cannot modify User A's private investigation via clarification response (403)", async () => {
      const threadId = `p0_1_owned_${Date.now()}_3`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Faulty engine repair dispute."
      });

      let caughtError = null;
      try {
        await saveClarificationResponse(threadId, "q1", "Malicious modification attempt", "Question text", userB);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError.statusCode).toBe(403);
    });

    test("4. User B cannot modify User A's private investigation via batch answers (403)", async () => {
      const threadId = `p0_1_owned_${Date.now()}_4`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Flight cancellation refund dispute."
      });

      let caughtError = null;
      try {
        await submitClarificationAnswers(threadId, [{ questionId: "q1", answer: "Tampered answer" }], userB);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError.statusCode).toBe(403);
    });

    test("5. User B cannot modify User A's private investigation via updateStage (403)", async () => {
      const threadId = `p0_1_owned_${Date.now()}_5`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Defective laptop warranty dispute."
      });

      let caughtError = null;
      try {
        await updateStage(threadId, INVESTIGATION_STAGES.AWAITING_CLARIFICATION, userB);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError.statusCode).toBe(403);
    });

    test("6. Legitimate owner (User A) can access and modify their own investigation (200)", async () => {
      const threadId = `p0_1_owned_${Date.now()}_6`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Legitimate user dispute regarding mobile repair."
      });

      const doc = await getThread(threadId, userA);
      expect(doc).not.toBeNull();
      expect(doc.threadId).toBe(threadId);
      expect(doc.userId.toString()).toBe(userA.toString());
    });

    test("7. Guest workflow is supported: unauthenticated user can access unowned guest investigations", async () => {
      const threadId = `p0_1_guest_${Date.now()}_7`;
      await createInvestigation({
        threadId,
        userId: null, // Guest case
        complaint: "Public guest investigation regarding ecommerce delivery."
      });

      // Guest access without userId is permitted
      const doc = await getThread(threadId, null);
      expect(doc).not.toBeNull();
      expect(doc.threadId).toBe(threadId);
      expect(doc.userId).toBeNull();

      // Guest can also add clarification answers
      const updated = await saveClarificationResponse(threadId, "q1", "Guest clarification answer", "Question text", null);
      expect(updated.clarificationHistory).toHaveLength(1);
    });

    test("8. Missing investigation returns null or throws 404", async () => {
      const nonExistent = `non_existent_thread_${Date.now()}`;
      const doc = await getThread(nonExistent, userA);
      expect(doc).toBeNull();

      let caughtError = null;
      try {
        await updateStage(nonExistent, INVESTIGATION_STAGES.AWAITING_CLARIFICATION, userA);
      } catch (err) {
        caughtError = err;
      }
      expect(caughtError).not.toBeNull();
      expect(caughtError.statusCode).toBe(404);
    });
  });

  // =========================================================================
  // P0-2: Mass Assignment Prevention
  // =========================================================================
  describe("P0-2: Mass Assignment Prevention", () => {
    test("9. Attempt to overwrite userId via stage update is rejected and does not modify record", async () => {
      const threadId = `p0_2_mass_${Date.now()}_1`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Protected field integrity check."
      });

      const attackerId = new mongoose.Types.ObjectId().toString();

      await expect(
        updateStage(threadId, INVESTIGATION_STAGES.AWAITING_CLARIFICATION, userA, {
          userId: attackerId
        })
      ).rejects.toThrow(/Modification of protected internal field "userId" is prohibited/);

      // Verify stored record was NOT modified
      const current = await getThread(threadId, userA);
      expect(current.userId.toString()).toBe(userA.toString());
      expect(current.stage).toBe(INVESTIGATION_STAGES.INITIAL_ANALYSIS);
    });

    test("10. Attempt to overwrite assessment via stage update is rejected and does not modify record", async () => {
      const threadId = `p0_2_mass_${Date.now()}_2`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Assessment protected field integrity check."
      });

      await expect(
        updateStage(threadId, INVESTIGATION_STAGES.AWAITING_CLARIFICATION, userA, {
          assessment: { status: "COMPLETED", summary: "Malicious premature judgment." }
        })
      ).rejects.toThrow(/Modification of protected internal field "assessment" is prohibited/);

      const current = await getThread(threadId, userA);
      expect(current.assessment.status).toBe("NOT_READY");
    });

    test("11. Attempt to overwrite investigationGate via stage update is rejected and does not modify record", async () => {
      const threadId = `p0_2_mass_${Date.now()}_3`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Gate override tampering check."
      });

      await expect(
        updateStage(threadId, INVESTIGATION_STAGES.AWAITING_CLARIFICATION, userA, {
          investigationGate: { isSatisfied: true, missingCriticalEvidence: [] }
        })
      ).rejects.toThrow(/Modification of protected internal field "investigationGate" is prohibited/);

      const current = await getThread(threadId, userA);
      expect(current.investigationGate.isSatisfied).toBe(false);
    });

    test("12. Attempt to overwrite evidenceInventory via stage update is rejected and does not modify record", async () => {
      const threadId = `p0_2_mass_${Date.now()}_4`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Evidence inventory tampering check."
      });

      await expect(
        updateStage(threadId, INVESTIGATION_STAGES.AWAITING_CLARIFICATION, userA, {
          evidenceInventory: [{ title: "Forged receipt", status: "VERIFIED" }]
        })
      ).rejects.toThrow(/Modification of protected internal field "evidenceInventory" is prohibited/);

      const current = await getThread(threadId, userA);
      expect(current.evidenceInventory).toHaveLength(0);
    });

    test("13. Unsupported or arbitrary metadata fields are rejected with 400", async () => {
      const threadId = `p0_2_mass_${Date.now()}_5`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Arbitrary field injection check."
      });

      await expect(
        updateStage(threadId, INVESTIGATION_STAGES.AWAITING_CLARIFICATION, userA, {
          arbitraryInjectionField: "test_value"
        })
      ).rejects.toThrow(/Unsupported metadata field: "arbitraryInjectionField"/);
    });

    test("14. Legitimate allowlisted metadata fields are accepted and saved safely", async () => {
      const threadId = `p0_2_mass_${Date.now()}_6`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Allowlist legitimate metadata check."
      });

      const updated = await updateStage(threadId, INVESTIGATION_STAGES.AWAITING_CLARIFICATION, userA, {
        notes: "Investigation moved to clarification stage by case investigator.",
        reason: "Initial complaint analyzed."
      });

      expect(updated.stage).toBe(INVESTIGATION_STAGES.AWAITING_CLARIFICATION);
      expect(updated.notes).toBe("Investigation moved to clarification stage by case investigator.");
      expect(updated.reason).toBe("Initial complaint analyzed.");
    });
  });

  // =========================================================================
  // P0-3: Premature State Transitions
  // =========================================================================
  describe("P0-3: Premature State Transitions", () => {
    test("15. Direct INITIAL_ANALYSIS to READY_FOR_ASSESSMENT transition is strictly prevented", async () => {
      const threadId = `p0_3_state_${Date.now()}_1`;
      await createInvestigation({
        threadId,
        complaint: "Attempting to skip clarification and evidence directly to assessment."
      });

      // State machine table check
      expect(ALLOWED_STAGE_TRANSITIONS.INITIAL_ANALYSIS).not.toContain(INVESTIGATION_STAGES.READY_FOR_ASSESSMENT);

      // Runtime updateStage check
      await expect(
        updateStage(threadId, INVESTIGATION_STAGES.READY_FOR_ASSESSMENT)
      ).rejects.toThrow(/Invalid stage transition from "INITIAL_ANALYSIS" to "READY_FOR_ASSESSMENT"/);
    });

    test("16. Direct INITIAL_ANALYSIS to ASSESSMENT_COMPLETE transition is strictly prevented", async () => {
      const threadId = `p0_3_state_${Date.now()}_2`;
      await createInvestigation({
        threadId,
        complaint: "Attempting to jump from intake directly to completed judgment."
      });

      await expect(
        updateStage(threadId, INVESTIGATION_STAGES.ASSESSMENT_COMPLETE)
      ).rejects.toThrow(/Invalid stage transition from "INITIAL_ANALYSIS" to "ASSESSMENT_COMPLETE"/);
    });

    test("17. Transition to READY_FOR_ASSESSMENT is prohibited while clarification is incomplete", async () => {
      const threadId = `p0_3_state_${Date.now()}_3`;
      await createInvestigation({
        threadId,
        complaint: "Incomplete clarification transition test."
      });

      // Move to EVIDENCE_REVIEW through valid path
      await updateStage(threadId, INVESTIGATION_STAGES.AWAITING_CLARIFICATION);
      await updateStage(threadId, INVESTIGATION_STAGES.EVIDENCE_REVIEW);

      // Now attempt transition to READY_FOR_ASSESSMENT while isClarificationComplete is false
      await expect(
        updateStage(threadId, INVESTIGATION_STAGES.READY_FOR_ASSESSMENT)
      ).rejects.toThrow("Cannot transition to READY_FOR_ASSESSMENT while clarification is incomplete.");
    });

    test("18. Advancing investigation when questions end transitions to AWAITING_EVIDENCE, NOT READY_FOR_ASSESSMENT", async () => {
      const threadId = `p0_3_state_${Date.now()}_4`;
      await createInvestigation({
        threadId,
        complaint: "Clarification end stage validation."
      });

      // Advance round marking clarification complete
      const completed = await advanceInvestigationRound(threadId, [], true);
      expect(completed.isClarificationComplete).toBe(true);
      expect(completed.stage).toBe(INVESTIGATION_STAGES.AWAITING_EVIDENCE);
      expect(completed.stage).not.toBe(INVESTIGATION_STAGES.READY_FOR_ASSESSMENT);
    });
  });

  // =========================================================================
  // Route-Level API Endpoint Enforcement
  // =========================================================================
  describe("Route-Level Security and Authorization Enforcement", () => {
    test("19. GET /api/investigation/:threadId returns 401 when unauthenticated caller accesses owned investigation", async () => {
      const threadId = `p0_route_${Date.now()}_1`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Sensitive case owned by User A."
      });

      const req = {
        params: { threadId },
        headers: {},
        user: null // Unauthenticated
      };
      const res = createMockRes();

      await executeRoute(investigationRouter, "/:threadId", "GET", req, res);

      expect(res.statusCode).toBe(401);
      expect(res.data.error).toContain("Authentication required");
    });

    test("20. GET /api/investigation/:threadId returns 403 when User B accesses User A's investigation", async () => {
      const threadId = `p0_route_${Date.now()}_2`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Sensitive case owned by User A."
      });

      const req = {
        params: { threadId },
        headers: {},
        user: { _id: userB } // User B
      };
      const res = createMockRes();

      await executeRoute(investigationRouter, "/:threadId", "GET", req, res);

      expect(res.statusCode).toBe(403);
      expect(res.data.error).toContain("Access denied: You do not own this investigation case.");
    });

    test("21. GET /api/investigation/:threadId returns 404 when threadId does not exist", async () => {
      const req = {
        params: { threadId: `non_existent_${Date.now()}` },
        headers: {},
        user: { _id: userA }
      };
      const res = createMockRes();

      await executeRoute(investigationRouter, "/:threadId", "GET", req, res);

      expect(res.statusCode).toBe(404);
    });

    test("22. PATCH /api/investigation/:threadId/stage returns 400 when client directly requests READY_FOR_ASSESSMENT", async () => {
      const threadId = `p0_route_${Date.now()}_3`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Workflow bypass attempt test."
      });

      const req = {
        params: { threadId },
        headers: {},
        user: { _id: userA },
        body: {
          stage: INVESTIGATION_STAGES.READY_FOR_ASSESSMENT
        }
      };
      const res = createMockRes();

      await executeRoute(investigationRouter, "/:threadId/stage", "PATCH", req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.error).toContain("Direct client transition to stage \"READY_FOR_ASSESSMENT\" is prohibited");
    });

    test("23. PATCH /api/investigation/:threadId/stage returns 400 when client attempts to inject protected fields", async () => {
      const threadId = `p0_route_${Date.now()}_4`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Mass assignment HTTP endpoint test."
      });

      const req = {
        params: { threadId },
        headers: {},
        user: { _id: userA },
        body: {
          stage: INVESTIGATION_STAGES.AWAITING_CLARIFICATION,
          metadata: {
            userId: userB,
            assessment: { status: "COMPLETED" }
          }
        }
      };
      const res = createMockRes();

      await executeRoute(investigationRouter, "/:threadId/stage", "PATCH", req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.error).toContain("Modification of protected internal field");
    });

    test("24. POST /api/investigation/:threadId/clarify returns 403 when User B tries to modify User A's thread", async () => {
      const threadId = `p0_route_${Date.now()}_5`;
      await createInvestigation({
        threadId,
        userId: userA,
        complaint: "Authorization enforcement test."
      });

      const req = {
        params: { threadId },
        headers: {},
        user: { _id: userB },
        body: {
          questionId: "q1",
          answer: "Unauthorized answer submission"
        }
      };
      const res = createMockRes();

      await executeRoute(investigationRouter, "/:threadId/clarify", "POST", req, res);

      expect(res.statusCode).toBe(403);
      expect(res.data.error).toContain("Access denied: You do not own this investigation case.");
    });
  });
});
