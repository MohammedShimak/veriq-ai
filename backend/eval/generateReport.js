import fs from "fs";
import path from "path";
import { computeMetrics } from "./metrics.js";

const RESULTS_DIR = path.resolve("./eval/results");
const BASELINE_PATH = path.join(RESULTS_DIR, "baseline_results.json");
const LEXAGENT_PATH = path.join(RESULTS_DIR, "lexagent_results.json");
const ABLATION_PATH = path.join(RESULTS_DIR, "ablation_results.json");
const REPORT_OUTPUT_PATH = path.join(RESULTS_DIR, "report.md");

function generateMarkdownReport() {
  console.log("=========================================");
  console.log("LEXAGENT RESEARCH REPORT GENERATOR");
  console.log("=========================================\n");

  if (!fs.existsSync(BASELINE_PATH) || !fs.existsSync(LEXAGENT_PATH)) {
    throw new Error(`Results files missing. Run baseline and lexagent evaluation scripts first.`);
  }

  const baselineData = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf-8"));
  const lexagentData = JSON.parse(fs.readFileSync(LEXAGENT_PATH, "utf-8"));

  const baselineMetrics = computeMetrics(baselineData);
  const lexagentMetrics = computeMetrics(lexagentData);

  let ablationMetrics = null;
  if (fs.existsSync(ABLATION_PATH)) {
    try {
      const ablationData = JSON.parse(fs.readFileSync(ABLATION_PATH, "utf-8"));
      ablationMetrics = {
        no_rag: computeMetrics(ablationData.no_rag || []),
        no_debate: computeMetrics(ablationData.no_debate || []),
        no_grounding: computeMetrics(ablationData.no_grounding || [])
      };
    } catch (e) {
      console.warn("⚠️ Ablation results loading warning:", e.message);
    }
  }

  const reportLines = [
    "# LexAgent Research Evaluation & Benchmark Report",
    "",
    "Automated empirical evaluation comparing **System A (Plain LLM Baseline)** vs **System B (LexAgent Multi-Agent Pipeline)** on a labeled benchmark dataset of Indian Consumer Protection Act, 2019 legal dispute judgments.",
    "",
    "---",
    "",
    "## 📊 Executive Summary Comparison Table",
    "",
    "| Metric | Plain LLM Baseline (System A) | LexAgent Full Pipeline (System B) | Delta / Absolute Gain |",
    "| :--- | :---: | :---: | :---: |",
    `| **Outcome Accuracy** | ${(baselineMetrics.outcome_accuracy * 100).toFixed(1)}% | **${(lexagentMetrics.outcome_accuracy * 100).toFixed(1)}%** | +${((lexagentMetrics.outcome_accuracy - baselineMetrics.outcome_accuracy) * 100).toFixed(1)}% |`,
    `| **Section Citation Macro-F1** | ${baselineMetrics.section_f1.toFixed(3)} | **${lexagentMetrics.section_f1.toFixed(3)}** | +${(lexagentMetrics.section_f1 - baselineMetrics.section_f1).toFixed(3)} |`,
    `| **Section Citation Precision** | ${baselineMetrics.section_precision.toFixed(3)} | **${lexagentMetrics.section_precision.toFixed(3)}** | +${(lexagentMetrics.section_precision - baselineMetrics.section_precision).toFixed(3)} |`,
    `| **Section Citation Recall** | ${baselineMetrics.section_recall.toFixed(3)} | **${lexagentMetrics.section_recall.toFixed(3)}** | +${(lexagentMetrics.section_recall - baselineMetrics.section_recall).toFixed(3)} |`,
    `| **Citation Hallucination Rate** | ${(baselineMetrics.hallucination_rate * 100).toFixed(1)}% | **${(lexagentMetrics.hallucination_rate * 100).toFixed(1)}%** | -${((baselineMetrics.hallucination_rate - lexagentMetrics.hallucination_rate) * 100).toFixed(1)}% |`,
    `| **Expected Calibration Error (ECE)** | ${baselineMetrics.ece.toFixed(3)} | **${lexagentMetrics.ece.toFixed(3)}** | -${(baselineMetrics.ece - lexagentMetrics.ece).toFixed(3)} |`,
    `| **Average Model Confidence** | ${(baselineMetrics.avg_confidence * 100).toFixed(1)}% | ${(lexagentMetrics.avg_confidence * 100).toFixed(1)}% | - |`,
    "",
    "---",
    "",
    "## 📂 Category-Wise Accuracy Breakdown",
    "",
    "| Dispute Category | Plain LLM Baseline | LexAgent Pipeline | Total Test Cases |",
    "| :--- | :---: | :---: | :---: |",
    ...Object.keys(lexagentMetrics.category_accuracy || {}).map((cat) => {
      const baseAcc = baselineMetrics.category_accuracy[cat] !== undefined ? `${(baselineMetrics.category_accuracy[cat] * 100).toFixed(1)}%` : "N/A";
      const lexAcc = `${(lexagentMetrics.category_accuracy[cat] * 100).toFixed(1)}%`;
      return `| **${cat}** | ${baseAcc} | **${lexAcc}** | ${lexagentData.filter(d => d.category === cat).length} |`;
    }),
    "",
    "---",
    "",
    "## 🔬 Module C: Semantic Grounding & Entailment Fact-Checking Analysis",
    "",
    "The Semantic Grounding Layer (semanticValidator.js) performs LLM-based semantic entailment checks on statutory section-citing sentences across Support, Oppose, and Judicial Bench outputs against retrieved statutory text.",
    "",
    `- **Total Claim Sentences Fact-Checked**: ${lexagentMetrics.semantic_grounding.total_claims_checked}`,
    `- **Entailment Rate**: **${(lexagentMetrics.semantic_grounding.entailment_rate * 100).toFixed(1)}%** (Claims directly supported by retrieved CPA 2019 statutory text)`,
    `- **Contradiction Rate**: ${(lexagentMetrics.semantic_grounding.contradiction_rate * 100).toFixed(1)}% (Claims directly conflicting with statutory text)`,
    `- **Unsupported Rate**: ${(lexagentMetrics.semantic_grounding.unsupported_rate * 100).toFixed(1)}% (Claims exceeding statutory context window)`,
    "",
    ablationMetrics ? [
      "---",
      "",
      "## 🧪 Ablation Study Results",
      "",
      "Evaluating the contribution of key architectural modules:",
      "",
      "| System Variant | Outcome Accuracy | Section Citation F1 | Hallucination Rate | ECE |",
      "| :--- | :---: | :---: | :---: | :---: |",
      `| **Full LexAgent Pipeline** | **${(lexagentMetrics.outcome_accuracy * 100).toFixed(1)}%** | **${lexagentMetrics.section_f1.toFixed(3)}** | **${(lexagentMetrics.hallucination_rate * 100).toFixed(1)}%** | **${lexagentMetrics.ece.toFixed(3)}** |`,
      `| **Ablation: No RAG (Empty Context)** | ${(ablationMetrics.no_rag.outcome_accuracy * 100).toFixed(1)}% | ${ablationMetrics.no_rag.section_f1.toFixed(3)} | ${(ablationMetrics.no_rag.hallucination_rate * 100).toFixed(1)}% | ${ablationMetrics.no_rag.ece.toFixed(3)} |`,
      `| **Ablation: No Adversarial Debate** | ${(ablationMetrics.no_debate.outcome_accuracy * 100).toFixed(1)}% | ${ablationMetrics.no_debate.section_f1.toFixed(3)} | ${(ablationMetrics.no_debate.hallucination_rate * 100).toFixed(1)}% | ${ablationMetrics.no_debate.ece.toFixed(3)} |`,
      `| **Ablation: No Grounding Layer** | ${(ablationMetrics.no_grounding.outcome_accuracy * 100).toFixed(1)}% | ${ablationMetrics.no_grounding.section_f1.toFixed(3)} | ${(ablationMetrics.no_grounding.hallucination_rate * 100).toFixed(1)}% | ${ablationMetrics.no_grounding.ece.toFixed(3)} |`,
      ""
    ].join("\n") : "",
    "---",
    "",
    "## 📋 Case-by-Case Detailed Prediction Log (First 15 Cases)",
    "",
    "| Case ID | Category | Ground Truth Outcome | Baseline Prediction | LexAgent Prediction | Baseline Match | LexAgent Match |",
    "| :--- | :--- | :--- | :--- | :--- | :---: | :---: |",
    ...lexagentData.slice(0, 15).map((item, idx) => {
      const baseItem = baselineData[idx] || {};
      const ground = item.ground_truth?.outcome || "Consumer Wins";
      const basePred = baseItem.prediction?.predicted_outcome || "Inconclusive";
      const lexPred = item.prediction?.predicted_outcome || "Inconclusive";

      const baseMatch = ground === basePred ? "✅" : "❌";
      const lexMatch = ground === lexPred ? "✅" : "❌";

      return `| \`${item.eval_id}\` | ${item.category} | ${ground} | ${basePred} | ${lexPred} | ${baseMatch} | ${lexMatch} |`;
    })
  ];

  fs.writeFileSync(REPORT_OUTPUT_PATH, reportMdLinesToString(reportLines), "utf-8");
  console.log("=========================================");
  console.log(`✅ RESEARCH REPORT GENERATED AT: ${REPORT_OUTPUT_PATH}`);
  console.log("=========================================\n");
}

function reportMdLinesToString(lines) {
  return lines.flatMap(line => Array.isArray(line) ? line : [line]).join("\n");
}

try {
  generateMarkdownReport();
} catch (err) {
  console.error("🛑 Error generating report:", err);
  process.exit(1);
}
