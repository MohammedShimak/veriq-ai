import express from "express";
import {
  HELP_HUB_INTENTS,
  CONSUMER_CATEGORIES,
  PROCEDURAL_KNOWLEDGE,
  generateDocumentDraft,
  searchHelpHubKnowledge
} from "../services/helpHubService.js";

const router = express.Router();

/**
 * @route GET /api/help-hub/intents
 * @desc Retrieves the 4 primary Help Hub intents
 */
router.get("/intents", (req, res) => {
  return res.status(200).json({
    success: true,
    intents: Object.values(HELP_HUB_INTENTS)
  });
});

/**
 * @route GET /api/help-hub/categories
 * @desc Retrieves all consumer dispute categories with checklists and scenarios
 */
router.get("/categories", (req, res) => {
  return res.status(200).json({
    success: true,
    categories: CONSUMER_CATEGORIES
  });
});

/**
 * @route GET /api/help-hub/categories/:categoryId
 * @desc Retrieves specific consumer dispute category details
 */
router.get("/categories/:categoryId", (req, res) => {
  const { categoryId } = req.params;
  const category = CONSUMER_CATEGORIES.find((c) => c.id === categoryId);
  if (!category) {
    return res.status(404).json({
      error: `Category "${categoryId}" not found.`
    });
  }
  return res.status(200).json({
    success: true,
    category
  });
});

/**
 * @route GET /api/help-hub/procedural
 * @desc Retrieves verified procedural knowledge (jurisdiction, fees, limitation period, official portals)
 */
router.get("/procedural", (req, res) => {
  return res.status(200).json({
    success: true,
    procedural: PROCEDURAL_KNOWLEDGE
  });
});

/**
 * @route POST /api/help-hub/draft
 * @desc Generates structured document drafts with placeholders and draft disclaimers
 */
router.post("/draft", (req, res) => {
  try {
    const { documentType, category, consumerData } = req.body;

    const validTypes = ["CONSUMER_COMPLAINT", "GRIEVANCE_EMAIL", "REFUND_REQUEST", "LEGAL_NOTICE"];
    const docType = validTypes.includes(documentType) ? documentType : "CONSUMER_COMPLAINT";

    const draft = generateDocumentDraft({
      documentType: docType,
      category: category || "ecommerce_retail",
      consumerData: consumerData || {}
    });

    return res.status(200).json({
      success: true,
      draft
    });
  } catch (err) {
    console.error("❌ Error generating document draft:", err.message);
    return res.status(500).json({
      error: err.message || "Failed to generate document draft."
    });
  }
});

/**
 * @route POST /api/help-hub/search
 * @desc Searches Help Hub procedural knowledge and returns matched guidance
 */
router.post("/search", (req, res) => {
  try {
    const { query } = req.body;
    const result = searchHelpHubKnowledge(query || "");
    return res.status(200).json({
      success: true,
      result
    });
  } catch (err) {
    console.error("❌ Error searching Help Hub knowledge:", err.message);
    return res.status(500).json({
      error: err.message || "Failed to perform Help Hub knowledge search."
    });
  }
});

export default router;
