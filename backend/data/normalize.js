import fs from "fs";
import path from "path";
import Ajv from "ajv";
import { loadLegislationAndRules } from "./adapters/legislationAdapter.js";
import { loadJudgmentsAndPrecedents } from "./adapters/judgmentsAdapter.js";
import { loadHFCorpusAndSecondaryQA } from "./adapters/hfCorpusAdapter.js";

const SCHEMA_PATH = path.resolve("./data/schemas/unifiedRecord.schema.json");
const NORMALIZED_DIR = path.resolve("./data/normalized");

async function runMasterNormalization() {
  console.log("=========================================");
  console.log("LEXAGENT MASTER DATA NORMALIZATION");
  console.log("=========================================\n");

  // Ensure normalized output directory exists
  if (!fs.existsSync(NORMALIZED_DIR)) {
    fs.mkdirSync(NORMALIZED_DIR, { recursive: true });
  }

  // Load and compile AJV schema
  const ajv = new Ajv({ allErrors: true, useDefaults: true });
  const schemaJson = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf-8"));
  const validate = ajv.compile(schemaJson);

  // Load records from adapters
  const { statutes, rules } = loadLegislationAndRules();
  const precedents = loadJudgmentsAndPrecedents();
  const caseLaw = loadHFCorpusAndSecondaryQA();

  const allRecords = [
    { type: "statutes", data: statutes, file: "statutes.json" },
    { type: "rules", data: rules, file: "rules.json" },
    { type: "precedents", data: precedents, file: "precedents.json" },
    { type: "case_law", data: caseLaw, file: "case_law.json" }
  ];

  let totalCount = 0;
  let validationErrors = 0;

  allRecords.forEach((group) => {
    console.log(`\n🔍 Validating ${group.data.length} ${group.type} records against unified schema...`);
    
    group.data.forEach((rec, idx) => {
      const valid = validate(rec);
      if (!valid) {
        validationErrors++;
        console.error(`❌ Validation failed for ${group.type} record #${idx + 1} (${rec.doc_id}):`, validate.errors);
      }
    });

    const outputPath = path.join(NORMALIZED_DIR, group.file);
    fs.writeFileSync(outputPath, JSON.stringify(group.data, null, 2), "utf-8");
    console.log(`✅ Saved ${group.data.length} normalized records to ${outputPath}`);
    totalCount += group.data.length;
  });

  console.log("\n=========================================");
  console.log("NORMALIZATION SUMMARY TABLE");
  console.log("=========================================");
  console.log(`Statutes:   ${statutes.length} records`);
  console.log(`Rules:      ${rules.length} records`);
  console.log(`Precedents: ${precedents.length} records`);
  console.log(`Case Law:   ${caseLaw.length} records`);
  console.log(`TOTAL:      ${totalCount} normalized records`);
  console.log(`VALIDATION: ${validationErrors === 0 ? "100% PASSED ✅" : `${validationErrors} ERRORS ❌`}`);
  console.log("=========================================\n");

  if (validationErrors > 0) {
    console.error("🛑 Normalization failed due to schema validation errors.");
    process.exit(1);
  }
}

runMasterNormalization().catch((err) => {
  console.error("🛑 Error running master normalization:", err);
  process.exit(1);
});
