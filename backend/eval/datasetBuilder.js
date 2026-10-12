import fs from "fs";
import path from "path";
import Ajv from "ajv";

const SCHEMA_PATH = path.resolve("./eval/schemas/evalRecord.schema.json");
const DATASET_OUTPUT_DIR = path.resolve("./eval/dataset");
const BENCHMARK_OUTPUT_PATH = path.join(DATASET_OUTPUT_DIR, "benchmark_dataset.json");

const GOLD_BENCHMARK_PATH = path.resolve("./data/gold_evaluation_benchmark.json");
const HELDOUT_BENCHMARK_PATH = path.resolve("./data/heldout_benchmark_dataset.json");
const EXPANDED_BENCHMARK_PATH = path.resolve("./data/expanded_consumer_eval_set.json");

function buildEvaluationDataset() {
  console.log("=========================================");
  console.log("LEXAGENT BENCHMARK DATASET BUILDER");
  console.log("=========================================\n");

  if (!fs.existsSync(DATASET_OUTPUT_DIR)) {
    fs.mkdirSync(DATASET_OUTPUT_DIR, { recursive: true });
  }

  const ajv = new Ajv({ allErrors: true, useDefaults: true });
  const schemaJson = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf-8"));
  const validate = ajv.compile(schemaJson);

  const rawCases = [];

  // 1. Read Gold Benchmark
  if (fs.existsSync(GOLD_BENCHMARK_PATH)) {
    const goldData = JSON.parse(fs.readFileSync(GOLD_BENCHMARK_PATH, "utf-8"));
    goldData.forEach((item, idx) => {
      rawCases.push({
        eval_id: item.case_id || `eval_gold_${idx + 1}`,
        category: item.category || item.case_category || "Defective Product",
        case_facts: item.question || item.case_facts || item.facts || "Consumer dispute submitted under CPA 2019",
        ground_truth: {
          outcome: item.ground_truth_verdict === "ALLOWED" || item.ground_truth_verdict === "Consumer Wins" ? "Consumer Wins" : item.ground_truth_verdict === "DISMISSED" ? "Respondent Wins" : "Inconclusive",
          sections_invoked: item.ground_truth_sections || item.sections_invoked || ["Section 2(10)", "Section 39"],
          relief_granted: item.relief_granted || item.relief || "Refund / Compensation",
          court: item.court || "District Commission",
          citation: item.citation || "NCDRC Precedent",
          source_url: item.source_url || ""
        },
        difficulty: item.difficulty || "straightforward"
      });
    });
  }

  // 2. Read Heldout Benchmark
  if (fs.existsSync(HELDOUT_BENCHMARK_PATH)) {
    const heldoutData = JSON.parse(fs.readFileSync(HELDOUT_BENCHMARK_PATH, "utf-8"));
    if (Array.isArray(heldoutData)) {
      heldoutData.forEach((item, idx) => {
        rawCases.push({
          eval_id: item.eval_id || item.case_id || `eval_heldout_${idx + 1}`,
          category: item.category || "General Consumer Dispute",
          case_facts: item.case_facts || item.question || "Dispute facts submitted",
          ground_truth: {
            outcome: item.ground_truth?.outcome || "Consumer Wins",
            sections_invoked: item.ground_truth?.sections_invoked || ["Section 2(11)"],
            relief_granted: item.ground_truth?.relief_granted || "Compensation",
            court: item.ground_truth?.court || "State Commission",
            citation: item.ground_truth?.citation || "Citation N/A",
            source_url: item.ground_truth?.source_url || ""
          },
          difficulty: item.difficulty || "nuanced"
        });
      });
    }
  }

  // Deduplicate cases by eval_id
  const uniqueMap = new Map();
  rawCases.forEach((c) => {
    if (!uniqueMap.has(c.eval_id)) {
      uniqueMap.set(c.eval_id, c);
    }
  });

  const dataset = Array.from(uniqueMap.values());
  let validationErrors = 0;

  dataset.forEach((record, idx) => {
    const valid = validate(record);
    if (!valid) {
      validationErrors++;
      console.error(`❌ Validation failed for benchmark case #${idx + 1} (${record.eval_id}):`, validate.errors);
    }
  });

  fs.writeFileSync(BENCHMARK_OUTPUT_PATH, JSON.stringify(dataset, null, 2), "utf-8");

  console.log("=========================================");
  console.log(`✅ BENCHMARK DATASET BUILT AT: ${BENCHMARK_OUTPUT_PATH}`);
  console.log(`Total Curated Cases: ${dataset.length}`);
  console.log(`Validation Status:   ${validationErrors === 0 ? "100% PASSED ✅" : `${validationErrors} ERRORS ❌`}`);
  console.log("=========================================\n");
}

try {
  buildEvaluationDataset();
} catch (err) {
  console.error("🛑 Error building evaluation dataset:", err);
  process.exit(1);
}
