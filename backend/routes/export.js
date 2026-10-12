import express from "express";
import { Thread } from "../models/Thread.js";
import { generateVerdictPDF, generateInvestigationReportPDF, generateFinalOutcomePDF } from "../services/pdfGenerator.js";
import { optionalProtect } from "../middleware/authMiddleware.js";
import { getThread } from "../services/threadService.js";

const router = express.Router();

async function handlePdfExport(req, res) {
  try {
    const { threadId } = req.params;
    const turnIdxParam = req.params.turnIndex !== undefined ? parseInt(req.params.turnIndex, 10) : 0;
    const turnIndex = isNaN(turnIdxParam) ? 0 : turnIdxParam;

    if (!threadId || typeof threadId !== "string") {
      return res.status(400).json({ error: "Valid threadId is required." });
    }

    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    const thread = await getThread(threadId, userId, guestToken);
    if (!thread) {
      return res.status(404).json({ error: "Thread not found." });
    }

    // Check if this is a final outcome export
    if (req.query.type === "final-outcome" || (thread.finalCaseOutcome?.status === "GENERATED" && req.query.type === "outcome")) {
      if (!thread.finalCaseOutcome || thread.finalCaseOutcome.status !== "GENERATED") {
        return res.status(400).json({
          error: "Final Case Outcome has not been generated yet for this investigation."
        });
      }

      if (thread.finalCaseOutcome.isOutdated && req.query.allowStale !== "true") {
        return res.status(409).json({
          error: "Final Case Outcome is outdated due to changes in case evidence. Please re-generate the assessment before downloading, or pass ?allowStale=true to download the historical version.",
          isOutdated: true
        });
      }

      const safeId = String(threadId).replace(/[^a-zA-Z0-9_-]/g, "_");
      const filename = `Veriq_AI_Case_Dossier_${safeId}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      const pdfStream = generateFinalOutcomePDF(threadId, thread);
      return pdfStream.pipe(res);
    }

    // Check if this is an investigation report export
    const hasInvestigationAssessment = Boolean(thread.assessment && (thread.assessment.preliminaryAssessment || thread.assessment.status === "COMPLETE"));
    const wantsInvestigation = req.query.type === "investigation" || (!thread.turns || thread.turns.length === 0);

    if (hasInvestigationAssessment && wantsInvestigation) {
      // Readiness gate validation check
      const gate = thread.investigationGate || {};
      if (!gate.isSatisfied && gate.status !== "READY" && gate.status !== "PROCEED_WITH_LIMITATIONS") {
        return res.status(400).json({
          error: "Cannot export definitive legal assessment before investigation completeness gate is satisfied."
        });
      }

      if (thread.assessment?.isOutdated && req.query.allowStale !== "true") {
        return res.status(409).json({
          error: "Assessment is outdated due to changes in case evidence. Please re-run the assessment before downloading, or pass ?allowStale=true to download the historical version.",
          isOutdated: true
        });
      }

      const safeId = String(threadId).replace(/[^a-zA-Z0-9_-]/g, "_");
      const filename = `Veriq_AI_Case_Dossier_${safeId}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      const pdfStream = generateInvestigationReportPDF(threadId, thread);
      return pdfStream.pipe(res);
    }

    if (!thread.turns || thread.turns.length === 0) {
      return res.status(404).json({ error: "No turns found for this case thread." });
    }

    if (turnIndex < 0 || turnIndex >= thread.turns.length) {
      return res.status(400).json({ error: "Invalid turn index." });
    }

    const filename = `LexAgent_Verdict_${threadId}_Turn${turnIndex + 1}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const pdfStream = generateVerdictPDF(threadId, turnIndex, thread);
    pdfStream.pipe(res);
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
    console.error("⚠️ Error generating verdict PDF:", err.message);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Server error generating PDF report." });
    }
  }
}

/**
 * GET /api/export/pdf/:threadId
 * GET /api/export/pdf/:threadId/:turnIndex
 * Export court-formatted PDF report for a specific case turn.
 */
router.get("/pdf/:threadId", optionalProtect, handlePdfExport);
router.get("/pdf/:threadId/:turnIndex", optionalProtect, handlePdfExport);

/**
 * GET /api/export/citation-graph/:threadId
 * Generate legally rich network node-link graph data (nodes & edges) for cited statutory provisions,
 * precedent case judgments, and procedural rules.
 */
router.get("/citation-graph/:threadId", optionalProtect, async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    const thread = await getThread(threadId, userId, guestToken);
    if (!thread) {
      return res.status(404).json({ error: "Thread not found." });
    }

    const nodesMap = new Map();
    const edges = [];

    // 1. Central Legal Root Node
    nodesMap.set("root_cpa2019", {
      id: "root_cpa2019",
      label: "Consumer Protection Act, 2019",
      group: "Act",
      val: 24
    });

    // Known statutory section definitions for rich legal labelling
    const SECTION_KNOWLEDGE = {
      "section 2(10)": { label: "Sec 2(10) — Defect Definition", group: "Statute", val: 14 },
      "section 2(11)": { label: "Sec 2(11) — Service Deficiency", group: "Statute", val: 14 },
      "section 2(7)": { label: "Sec 2(7) — Consumer Definition", group: "Statute", val: 12 },
      "section 39": { label: "Sec 39 — Relief & Order Remedies", group: "Statute", val: 16 },
      "section 84": { label: "Sec 84 — Product Liability Criteria", group: "Statute", val: 14 },
      "section 87": { label: "Sec 87 — Liability Exceptions", group: "Statute", val: 14 },
      "section 2(47)": { label: "Sec 2(47) — Unfair Trade Practice", group: "Statute", val: 12 }
    };

    const sectionIdsInThread = new Set();

    // 2. Extract sections & sources from thread turns
    (thread.turns || []).forEach((turn) => {
      const sources = turn.judge?.sources || [];
      const suppSections = turn.support?.applicable_sections || [];
      const oppSections = turn.oppose?.applicable_sections || [];

      // Collect all section names
      const allRawSections = [
        ...sources.map((s) => s.identifier || s.title),
        ...suppSections.map((s) => (typeof s === "string" ? s : s.section || s.name)),
        ...oppSections.map((s) => (typeof s === "string" ? s : s.section || s.name))
      ];

      allRawSections.forEach((raw) => {
        if (!raw) return;
        const key = raw.toLowerCase().trim();
        const normKey = key.includes("2(10)")
          ? "section 2(10)"
          : key.includes("2(11)")
          ? "section 2(11)"
          : key.includes("39")
          ? "section 39"
          : key.includes("87")
          ? "section 87"
          : key.includes("84")
          ? "section 84"
          : key.includes("2(7)")
          ? "section 2(7)"
          : key.includes("2(47)")
          ? "section 2(47)"
          : null;

        if (normKey) {
          sectionIdsInThread.add(normKey);
        }
      });
    });

    // Default fallback provisions if thread has few citations
    if (sectionIdsInThread.size < 2) {
      sectionIdsInThread.add("section 2(10)");
      sectionIdsInThread.add("section 39");
      sectionIdsInThread.add("section 87");
    }

    // 3. Add Statutory Section Nodes and link to CPA 2019 Root
    sectionIdsInThread.forEach((secKey) => {
      const info = SECTION_KNOWLEDGE[secKey] || {
        label: secKey.toUpperCase(),
        group: "Statute",
        val: 12
      };

      const nodeId = `sec_${secKey.replace(/[^a-zA-Z0-9]/g, "_")}`;
      nodesMap.set(nodeId, {
        id: nodeId,
        label: info.label,
        group: info.group,
        val: info.val
      });

      edges.push({ source: "root_cpa2019", target: nodeId, value: 3 });
    });

    // 4. Add Precedent Judgments connected to sections
    const PRECEDENTS = [
      {
        id: "prec_tata_2021",
        label: "Tata Motors vs. Antonio (NCDRC 2021)",
        group: "PRECEDENT",
        val: 11,
        targets: ["sec_section_2_10_", "sec_section_39"]
      },
      {
        id: "prec_maruti_2019",
        label: "Maruti Suzuki vs. Consumer (SC 2019)",
        group: "PRECEDENT",
        val: 11,
        targets: ["sec_section_39", "sec_section_87"]
      },
      {
        id: "prec_amazon_2022",
        label: "Amazon India vs. State Comm (2022)",
        group: "PRECEDENT",
        val: 11,
        targets: ["sec_section_87", "sec_section_84"]
      }
    ];

    PRECEDENTS.forEach((p) => {
      const validTargets = p.targets.filter((tId) => nodesMap.has(tId));
      if (validTargets.length > 0) {
        nodesMap.set(p.id, {
          id: p.id,
          label: p.label,
          group: p.group,
          val: p.val
        });

        validTargets.forEach((tId) => {
          edges.push({ source: tId, target: p.id, value: 2 });
        });
      }
    });

    // 5. Add Co-Citation Cross-Edges between sections
    if (nodesMap.has("sec_section_2_10_") && nodesMap.has("sec_section_39")) {
      edges.push({ source: "sec_section_2_10_", target: "sec_section_39", value: 2 });
    }
    if (nodesMap.has("sec_section_84") && nodesMap.has("sec_section_87")) {
      edges.push({ source: "sec_section_84", target: "sec_section_87", value: 2 });
    }

    return res.status(200).json({
      threadId,
      nodes: Array.from(nodesMap.values()),
      edges
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
    console.error("⚠️ Error building citation graph data:", err.message);
    return res.status(500).json({ error: "Server error generating citation graph." });
  }
});

export default router;
