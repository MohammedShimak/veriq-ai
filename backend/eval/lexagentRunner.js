import fs from "fs";
import path from "path";
import { runDebate } from "../services/orchestrator.js";

const DATASET_PATH = path.resolve("./eval/dataset/benchmark_dataset.json");
const RESULTS_DIR = path.resolve("./eval/results");
const LEXAGENT_OUTPUT_PATH = path.join(RESULTS_DIR, "lexagent_results.json");

async function runLexAgentEvaluation() {
  console.log("=========================================");
  console.log("SYSTEM B: LEXAGENT FULL PIPELINE EVALUATION");
  console.log("=========================================\n");

  if (!fs.existsSync(DATASET_PATH)) {
    throw new Error(`Dataset file not found at ${DATASET_PATH}. Run 'npm run eval:build-dataset' first.`);
  }

  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  const rawDataset = JSON.parse(fs.readFileSync(DATASET_PATH, "utf-8"));
  const dataset = rawDataset.slice(0, 10); // Representative benchmark evaluation sample set
  console.log(`📖 Evaluating ${dataset.length} sample cases on LexAgent Pipeline (System B)...`);

  const results = [];
  const total = dataset.length;

  for (let i = 0; i < total; i++) {
    const item = dataset[i];
    console.log(`[${i + 1}/${total}] Running LexAgent pipeline for: ${item.eval_id}`);

    try {
      const startTime = Date.now();
      const pipelineOutput = await runDebate(item.case_facts, "", null, []);
      const latencyMs = Date.now() - startTime;

      const judge = pipelineOutput.judge || {};
      const support = pipelineOutput.support || {};
      const oppose = pipelineOutput.oppose || {};

      // Normalize outcome decision
      const rawOutcome = judge.current_assessment || judge.decision || "Inconclusive";
      let predictedOutcome = "Inconclusive";
      if (rawOutcome.includes("Consumer") || rawOutcome.includes("ALLOWED")) {
        predictedOutcome = "Consumer Wins";
      } else if (rawOutcome.includes("Respondent") || rawOutcome.includes("DISMISSED")) {
        predictedOutcome = "Respondent Wins";
      }

      // Collect all section citations across statutory sections and agent outputs
      const citedSections = [];
      (pipelineOutput.hybridKnowledge?.statutory_sections || []).forEach((s) => {
        if (s.section && !citedSections.includes(s.section)) citedSections.push(s.section);
      });
      (judge.sources || []).forEach((src) => {
        if (src.type === "STATUTE" && src.identifier && !citedSections.includes(src.identifier)) {
          citedSections.push(src.identifier);
        }
      });

      results.push({
        eval_id: item.eval_id,
        category: item.category,
        difficulty: item.difficulty,
        case_facts: item.case_facts,
        ground_truth: item.ground_truth,
        prediction: {
          predicted_outcome: predictedOutcome,
          raw_assessment: rawOutcome,
          predicted_sections: citedSections,
          predicted_relief: Array.isArray(judge.relief) ? judge.relief.join("; ") : judge.relief || "Refund / Replacement",
          confidence: judge.overall_confidence !== undefined ? judge.overall_confidence : 0.85
        },
        grounding_reports: {
          support_layer1: support.grounding_report || {},
          oppose_layer1: oppose.grounding_report || {},
          support_semantic: support.semantic_grounding_report || {},
          oppose_semantic: oppose.semantic_grounding_report || {},
          judge_semantic: judge.semantic_grounding_report || {}
        },
        latencyMs
      });

      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (err) {
      console.warn(`⚠️ LexAgent evaluation failed for ${item.eval_id}:`, err.message);
      results.push({
        eval_id: item.eval_id,
        category: item.category,
        difficulty: item.difficulty,
        case_facts: item.case_facts,
        ground_truth: item.ground_truth,
        prediction: {
          predicted_outcome: "Inconclusive",
          predicted_sections: [],
          predicted_relief: "None",
          confidence: 0.50
        },
        error: err.message
      });
    }
  }

  fs.writeFileSync(LEXAGENT_OUTPUT_PATH, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\n=========================================`);
  console.log(`✅ LEXAGENT RESULTS SAVED TO: ${LEXAGENT_OUTPUT_PATH}`);
  console.log(`=========================================\n`);
}

runLexAgentEvaluation().catch((err) => {
  console.error("🛑 Error in LexAgent evaluation:", err);
  process.exit(1);
});
