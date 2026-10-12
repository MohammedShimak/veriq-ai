import { intentAgent } from "../agents/intentAgent.js";
import { caseReasoningAgent } from "../agents/caseReasoningAgent.js";
import { retrieveHybridLegalKnowledge } from "./hybridRetriever.js";
import { supportAgent } from "../agents/supportAgent.js";
import { opposeAgent } from "../agents/opposeAgent.js";
import { judgeAgent } from "../agents/judgeAgent.js";
import { validateAgentOutput } from "./groundingValidator.js";
import { semanticValidate } from "./semanticValidator.js";
import { isLiveEnabled } from "./indianKanoon.js";

// List of allowed consumer-law-relevant category keywords for Consumer Protection Act, 2019
const IN_SCOPE_KEYWORDS = [
  "defective product",
  "refund",
  "warranty",
  "e-commerce",
  "unfair trade practice",
  "product liability",
  "misleading advertisement",
  "consumer protection",
  "general consumer law",
  "consumer dispute",
  "general",
  "other / general"
];

function isCategoryInScope(category = "") {
  if (!category || typeof category !== "string") return true;
  const catClean = category.toLowerCase().trim();
  return IN_SCOPE_KEYWORDS.some((keyword) => catClean.includes(keyword));
}

/**
 * Fast Parallel Orchestrator with live step-by-step progress events and Module C Semantic Grounding.
 */
export async function runDebate(question, customContext = "", onEvent = null, history = []) {
  console.log("⚖ LexAgent Fast Multi-Agent Pipeline Started");

  const emit = (eventType, data) => {
    if (typeof onEvent === "function") {
      try {
        onEvent(eventType, data);
      } catch (err) {
        console.warn(`⚠️ Error emitting '${eventType}':`, err.message);
      }
    }
  };

  // 1. STEP 1: Domain Intent Classification
  emit("status", { message: "🔍 Step 1/5: Classifying domain intent under CPA 2019..." });
  let category = "General Consumer Law";
  let confidence = 80;
  let inScope = true;

  try {
    const intentSearchQuery = history.length > 0
      ? `${question} (Prior context: ${history.map(h => h.question).slice(-2).join("; ")})`
      : question;

    const intentResult = await intentAgent(intentSearchQuery);
    if (intentResult && typeof intentResult === "object" && intentResult.category) {
      category = intentResult.category;
      confidence = intentResult.confidence !== undefined ? intentResult.confidence : 80;
      inScope = isCategoryInScope(category) && confidence >= 40;
    }
  } catch (err) {
    console.warn("⚠️ intentAgent error, failing open:", err.message);
  }

  // Short-circuit if out of scope
  if (!inScope) {
    console.log(`🛑 OUT OF SCOPE: "${category}"`);
    const outOfScopeResult = {
      question,
      outOfScope: true,
      category,
      confidence,
      message: `This system currently only supports Indian Consumer Protection Act, 2019 related questions. Your question appears to be about: ${category}. Please rephrase as a consumer law issue or check back as more legal domains are added.`
    };
    emit("outOfScope", outOfScopeResult);
    emit("done", {});
    return outOfScopeResult;
  }

  emit("intent", { category, confidence });

  // 2. STEP 2: Case Understanding & Factual Reasoning (pass history to prevent repetition)
  emit("status", { message: "🧩 Step 2/5: Extracting structured facts & legal issues..." });
  const caseRepresentation = await caseReasoningAgent(question, history);
  emit("caseReasoning", caseRepresentation);

  // 3. STEP 3: Multi-Source Hybrid Knowledge Retrieval
  emit("status", {
    message: isLiveEnabled()
      ? "📖 Step 3/5: Searching CPA 2019 index + live Indian laws (Indian Kanoon), rules & precedents..."
      : "📖 Step 3/5: Searching CPA 2019 statutes, rules & precedents..."
  });
  const hybridKnowledge = await retrieveHybridLegalKnowledge(caseRepresentation, question);
  
  const retrievedContext = [
    ...(hybridKnowledge.statutory_sections || []).map(s => `[${s.section}, ${s.act} - ${s.title}]${s.source === "live" ? `\nSource: ${s.source_url}` : ""}\n${s.text}`),
    ...(hybridKnowledge.official_rules || []).map(r => `[${r.document_name} - ${r.rule}]\n${r.text}`),
    ...(hybridKnowledge.verified_precedents || []).map(p => `[Precedent: ${p.case_name} (${p.citation})]\n${p.facts_summary}`)
  ].join("\n\n");

  emit("retrieval", hybridKnowledge);

  // 4. STEP 4: Parallel Support & Oppose Counsel Execution with Semantic Grounding
  emit("status", { message: "⚖️ Step 4/5: Formulating Support & Oppose Counsel arguments with semantic validation..." });
  
  const [rawSupport, rawOppose] = await Promise.all([
    supportAgent(caseRepresentation, hybridKnowledge, history),
    opposeAgent(caseRepresentation, hybridKnowledge, history)
  ]);

  const support = validateAgentOutput("Support", rawSupport, retrievedContext);
  const oppose = validateAgentOutput("Oppose", rawOppose, retrievedContext);

  // Module C: Semantic Entailment Fact-checking Layer
  const [supportSemanticReport, opposeSemanticReport] = await Promise.all([
    semanticValidate("Support", support, retrievedContext),
    semanticValidate("Oppose", oppose, retrievedContext)
  ]);

  support.semantic_grounding_report = supportSemanticReport;
  oppose.semantic_grounding_report = opposeSemanticReport;

  // Calculate normalized 0-100 scores
  const supportScore = Math.min(100, Math.max(10,
    78 + Math.min(12, (support.applicable_sections || []).length * 4) +
    (supportSemanticReport?.summary?.entailed || 0) * 3 -
    ((support.grounding_report?.fabricated_sources || []).length * 15)
  ));

  const opposeScore = Math.min(100, Math.max(10,
    72 + Math.min(12, (oppose.applicable_sections || []).length * 4) +
    (opposeSemanticReport?.summary?.entailed || 0) * 3 -
    ((oppose.grounding_report?.fabricated_sources || []).length * 15)
  ));

  support.score = supportScore;
  oppose.score = opposeScore;

  emit("support", support);
  emit("oppose", oppose);
  emit("semanticGrounding", { support: supportSemanticReport, oppose: opposeSemanticReport });

  // 5. STEP 5: Judicial Bench Adjudication (Consumes Semantic Validation Reports)
  emit("status", { message: "🔨 Step 5/5: Judicial Bench evaluating evidence & rendering verdict..." });
  const rawJudge = await judgeAgent(caseRepresentation, hybridKnowledge, support, oppose, history);
  const judge = validateAgentOutput("Judge", rawJudge, retrievedContext);
  
  const judgeSemanticReport = await semanticValidate("Judge", judge, retrievedContext);
  judge.semantic_grounding_report = judgeSemanticReport;

  const rawJudgeConf = typeof judge.overall_confidence === "number" ? judge.overall_confidence : 0.85;
  const judgeScore = Math.min(100, Math.max(10, Math.round(rawJudgeConf * 100)));
  judge.score = judgeScore;

  const scores = {
    supportScore,
    opposeScore,
    judgeScore
  };

  emit("judge", judge);
  emit("scores", scores);

  emit("done", {});

  return {
    question,
    category,
    outOfScope: false,
    caseRepresentation,
    hybridKnowledge,
    retrievedContext,
    support,
    oppose,
    judge,
    scores
  };
}