import fs from "fs";
import path from "path";
import { generateContentWithRetry } from "../services/gemini.js";
import { safeParseJSON } from "../utils/jsonHelper.js";

const DATASET_PATH = path.resolve("./eval/dataset/benchmark_dataset.json");
const RESULTS_DIR = path.resolve("./eval/results");
const BASELINE_OUTPUT_PATH = path.join(RESULTS_DIR, "baseline_results.json");

async function runBaselineEvaluation() {
  console.log("=========================================");
  console.log("SYSTEM A: PLAIN LLM BASELINE EVALUATION");
  console.log("=========================================\n");

  if (!fs.existsSync(DATASET_PATH)) {
    throw new Error(`Dataset file not found at ${DATASET_PATH}. Run 'npm run eval:build-dataset' first.`);
  }

  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  const rawDataset = JSON.parse(fs.readFileSync(DATASET_PATH, "utf-8"));
  const dataset = rawDataset.slice(0, 10); // Representative benchmark evaluation sample set
  console.log(`📖 Evaluating ${dataset.length} sample cases on Plain LLM Baseline (System A)...`);

  const results = [];
  const total = dataset.length;

  for (let i = 0; i < total; i++) {
    const item = dataset[i];
    console.log(`[${i + 1}/${total}] Evaluating baseline for: ${item.eval_id}`);

    const prompt = `
You are a legal expert on the Indian Consumer Protection Act, 2019.
Given the following consumer dispute case facts, analyze and predict:
1. Outcome ("Consumer Wins" | "Respondent Wins" | "Inconclusive")
2. Applicable statutory sections (e.g. ["Section 2(10)", "Section 39"])
3. Relief granted
4. Confidence score (float 0.0 to 1.0)

CASE FACTS:
"${item.case_facts}"

Return ONLY a valid JSON object (no markdown, no code fences):
{
  "predicted_outcome": "Consumer Wins" | "Respondent Wins" | "Inconclusive",
  "predicted_sections": ["Section 2(10)", "Section 39"],
  "predicted_relief": "<relief granted>",
  "confidence": 0.85
}
`;

    try {
      const startTime = Date.now();
      const llmResult = await generateContentWithRetry(prompt);
      const text = llmResult.response.text();
      const parsed = safeParseJSON(text);
      const latencyMs = Date.now() - startTime;

      results.push({
        eval_id: item.eval_id,
        category: item.category,
        difficulty: item.difficulty,
        case_facts: item.case_facts,
        ground_truth: item.ground_truth,
        prediction: {
          predicted_outcome: parsed.predicted_outcome || "Inconclusive",
          predicted_sections: Array.isArray(parsed.predicted_sections) ? parsed.predicted_sections : [],
          predicted_relief: parsed.predicted_relief || "Refund",
          confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.70
        },
        latencyMs
      });

      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (err) {
      console.warn(`⚠️ Baseline evaluation failed for ${item.eval_id}:`, err.message);
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

  fs.writeFileSync(BASELINE_OUTPUT_PATH, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\n=========================================`);
  console.log(`✅ BASELINE RESULTS SAVED TO: ${BASELINE_OUTPUT_PATH}`);
  console.log(`=========================================\n`);
}

runBaselineEvaluation().catch((err) => {
  console.error("🛑 Error in baseline evaluation:", err);
  process.exit(1);
});
