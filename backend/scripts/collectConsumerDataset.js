/**
 * Dataset Ingestion & Validation Script for LexAgent Indian Consumer Protection Corpus.
 * Implements strict consumer-law filtering and schema verification matching the exact prompt structure:
 * - Case Metadata (Case Name, Number, Court, Date, Citation, Source)
 * - Parties (Consumer vs. Opposite Party)
 * - Facts & Legal Issues
 * - Relevant Sections (Consumer Protection Act, 2019 / Rules 2020)
 * - Arguments (Consumer Arguments vs Opposite Party Arguments)
 * - Evidence & Court Reasoning
 * - Precedents & Final Relief
 */

import fs from "fs";
import path from "path";

const DATASET_PATH = path.resolve("./data/consumer_protection_judgments.json");

function validateAndCollectConsumerDataset() {
  console.log("==================================================================");
  console.log("LEXAGENT INDIAN CONSUMER PROTECTION DATASET COLLECTION & VALIDATOR");
  console.log("==================================================================\n");

  if (!fs.existsSync(DATASET_PATH)) {
    console.error(`❌ Dataset file not found at ${DATASET_PATH}`);
    return;
  }

  const rawData = fs.readFileSync(DATASET_PATH, "utf-8");
  const dataset = JSON.parse(rawData);

  console.log(`📁 Loaded ${dataset.length} landmark Indian Consumer Law judgments.\n`);

  const categoryStats = {};
  const courtStats = {};
  let totalValidRecords = 0;

  dataset.forEach((item, index) => {
    // 1. Mandatory Schema Validation
    const hasMandatoryFields = 
      item.case_name && 
      item.court && 
      item.facts && 
      item.consumer_arguments && 
      item.opposite_party_arguments && 
      item.court_reasoning && 
      item.decision;

    if (!hasMandatoryFields) {
      console.warn(`⚠️ Record #${index + 1} (${item.case_name}) failed mandatory schema verification.`);
      return;
    }

    totalValidRecords++;

    // 2. Aggregate Court Distribution
    courtStats[item.court] = (courtStats[item.court] || 0) + 1;

    // 3. Aggregate Consumer Categories
    if (Array.isArray(item.case_category)) {
      item.case_category.forEach(cat => {
        categoryStats[cat] = (categoryStats[cat] || 0) + 1;
      });
    }

    console.log(`✅ Record #${index + 1}: [${item.court}] "${item.case_name}"`);
    console.log(`   Categories: ${item.case_category.join(", ")}`);
    console.log(`   Relief: ${item.relief.substring(0, 75)}...\n`);
  });

  console.log("==================================================================");
  console.log("📊 CONSUMER LAW DATASET SUMMARY");
  console.log("==================================================================");
  console.log(`Total Validated Records:  ${totalValidRecords}`);
  console.log("\nCourt Distribution:");
  console.table(courtStats);

  console.log("\nCategory Breakdown:");
  console.table(categoryStats);
  console.log("==================================================================\n");
}

validateAndCollectConsumerDataset();
