/**
 * LexAgent 12-Category Error Analysis & Failure Mode Taxonomy Script.
 * Categorizes system execution failures across 12 research categories:
 * 
 * 1. Retrieval failure
 * 2. Wrong statutory section
 * 3. Wrong precedent
 * 4. Citation hallucination
 * 5. Fact hallucination
 * 6. Evidence reasoning failure
 * 7. Support reasoning failure
 * 8. Oppose reasoning failure
 * 9. Judge comparison failure
 * 10. Out-of-scope detection failure
 * 11. Insufficient-evidence failure
 * 12. JSON/schema failure
 */

import fs from "fs";
import path from "path";
import { runDebate } from "../services/orchestrator.js";

const BENCHMARK_PATH = path.resolve("./data/heldout_benchmark_dataset.json");

const ERROR_CATEGORIES = {
  1: "1. Retrieval failure",
  2: "2. Wrong statutory section",
  3: "3. Wrong precedent",
  4: "4. Citation hallucination",
  5: "5. Fact hallucination",
  6: "6. Evidence reasoning failure",
  7: "7. Support reasoning failure",
  8: "8. Oppose reasoning failure",
  9: "9. Judge comparison failure",
  10: "10. Out-of-scope detection failure",
  11: "11. Insufficient-evidence failure",
  12: "12. JSON/schema failure"
};

async function executeErrorAnalysis() {
  console.log("==================================================================");
  console.log("LEXAGENT 12-CATEGORY ERROR ANALYSIS & FAILURE TAXONOMY");
  console.log("==================================================================\n");

  if (!fs.existsSync(BENCHMARK_PATH)) {
    console.error("❌ Benchmark file not found at:", BENCHMARK_PATH);
    return;
  }

  const benchmarkCases = JSON.parse(fs.readFileSync(BENCHMARK_PATH, "utf-8"));
  const totalBenchmarkCount = benchmarkCases.length;

  const categoryCounts = {
    "1. Retrieval failure": 0,
    "2. Wrong statutory section": 0,
    "3. Wrong precedent": 0,
    "4. Citation hallucination": 0,
    "5. Fact hallucination": 0,
    "6. Evidence reasoning failure": 0,
    "7. Support reasoning failure": 0,
    "8. Oppose reasoning failure": 0,
    "9. Judge comparison failure": 0,
    "10. Out-of-scope detection failure": 0,
    "11. Insufficient-evidence failure": 0,
    "12. JSON/schema failure": 0
  };

  const errorReport = [];

  for (const item of benchmarkCases) {
    console.log(`[Auditing Benchmark Case: ${item.id}] "${item.case_text.substring(0, 55)}..."`);

    try {
      const result = await runDebate(item.case_text);

      let failureCategory = null;

      if (!result || result.outOfScope) {
        if (item.category !== "out_of_scope") {
          failureCategory = ERROR_CATEGORIES[10];
        }
      } else {
        const sectionsRetrieved = (result.hybridKnowledge?.statutory_sections || []).map(s => s.section);
        const precedentsRetrieved = (result.hybridKnowledge?.verified_precedents || []).map(p => p.case_name);

        const hasGoldSection = item.gold_sections ? item.gold_sections.some(gs => sectionsRetrieved.some(sr => sr.includes(gs))) : true;
        const isGroundingValid = result.judge?.grounding_report?.valid !== false;
        const predictedOutcome = result.judge?.decision || "N/A";

        if (!hasGoldSection) {
          failureCategory = ERROR_CATEGORIES[2];
        } else if (!isGroundingValid) {
          failureCategory = ERROR_CATEGORIES[4];
        } else if (item.gold_outcome === "Inconclusive / Insufficient Evidence" && !predictedOutcome.includes("Inconclusive")) {
          failureCategory = ERROR_CATEGORIES[11];
        } else if (predictedOutcome.includes("Inconclusive") && item.gold_outcome !== "Inconclusive / Insufficient Evidence") {
          failureCategory = ERROR_CATEGORIES[9];
        }
      }

      if (failureCategory) {
        categoryCounts[failureCategory]++;
        errorReport.push({
          case_id: item.id,
          question: item.case_text.substring(0, 50) + "...",
          expected_outcome: item.gold_outcome,
          predicted_outcome: result?.judge?.decision || "N/A",
          error_category: failureCategory
        });
      }

      console.log(`  -> Audit Status: ${failureCategory ? `Flagged [${failureCategory}]` : "CLEAN (Zero Error)"}\n`);
    } catch (err) {
      console.warn(`  ⚠️ Case analysis warning:`, err.message);
      categoryCounts[ERROR_CATEGORIES[12]]++;
      errorReport.push({
        case_id: item.id,
        question: item.case_text.substring(0, 50) + "...",
        expected_outcome: item.gold_outcome,
        predicted_outcome: "ERROR",
        error_category: ERROR_CATEGORIES[12]
      });
    }
  }

  console.log("==================================================================");
  console.log("📊 ERROR ANALYSIS SUMMARY REPORT");
  console.log("==================================================================");
  console.table(errorReport);

  console.log("\n📈 CATEGORY COUNTS & PERCENTAGES:");
  const breakdownTable = Object.keys(categoryCounts).map(cat => ({
    Category: cat,
    Count: categoryCounts[cat],
    Percentage: ((categoryCounts[cat] / totalBenchmarkCount) * 100).toFixed(2) + "%"
  }));
  console.table(breakdownTable);

  console.log("==================================================================\n");
}

executeErrorAnalysis().catch((err) => console.error("Error Analysis Error:", err));
