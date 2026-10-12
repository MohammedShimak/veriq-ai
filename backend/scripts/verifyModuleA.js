import fs from "fs";
import path from "path";
import Ajv from "ajv";
import { loadFaissIndex, queryFaissIndex } from "../services/faissService.js";
import { validateAgentOutput } from "../services/groundingValidator.js";

const DATA_DIR = path.resolve("./data");
const NORMALIZED_DIR = path.join(DATA_DIR, "normalized");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function verifyNormalizedRecords() {
  const schema = readJson(path.join(DATA_DIR, "schemas", "unifiedRecord.schema.json"));
  const validate = new Ajv({ allErrors: true }).compile(schema);
  const groups = ["statutes", "rules", "precedents", "case_law"];
  let recordCount = 0;

  for (const group of groups) {
    const records = readJson(path.join(NORMALIZED_DIR, `${group}.json`));
    records.forEach((record, index) => {
      if (!validate(record)) {
        throw new Error(`${group}[${index}] failed schema validation: ${JSON.stringify(validate.errors)}`);
      }
    });
    recordCount += records.length;
  }

  return recordCount;
}

function verifyChunks() {
  const chunks = readJson(path.join(NORMALIZED_DIR, "chunks.json"));
  if (chunks.length === 0) throw new Error("No chunks were generated.");

  chunks.forEach((chunk, index) => {
    if (!chunk.chunk_id || !chunk.doc_id || !chunk.text || !chunk.metadata?.source_type) {
      throw new Error(`Chunk ${index} is missing required fields.`);
    }
  });

  return chunks.length;
}

async function main() {
  const records = verifyNormalizedRecords();
  const chunks = verifyChunks();
  const index = loadFaissIndex();
  if (index.length === 0) throw new Error("FAISS index is empty or missing.");

  const result = await queryFaissIndex(index[0].embedding, 1);
  if (!result[0]?.doc?.chunk_id || !result[0]?.metadata || typeof result[0].score !== "number") {
    throw new Error("FAISS query result does not match { doc, metadata, score } contract.");
  }

  const statutes = readJson(path.join(NORMALIZED_DIR, "statutes.json"));
  const precedents = readJson(path.join(NORMALIZED_DIR, "precedents.json"));
  const statute = statutes[0];
  const precedent = precedents.find((record) => record.verified);
  const grounded = validateAgentOutput("Module A verifier", {
    applicable_sections: [{ section: statute.metadata.section_or_rule }],
    supporting_precedents: [{
      case_name: precedent.metadata.case_name,
      citation: precedent.metadata.citation
    }]
  }, `${statute.metadata.section_or_rule} ${statute.text}`);

  if (!grounded.grounding_report.valid) {
    throw new Error(`Valid citation grounding failed: ${JSON.stringify(grounded.grounding_report)}`);
  }

  console.log(JSON.stringify({
    records,
    chunks,
    vectors: index.length,
    retrieval_contract: "passed",
    grounding_contract: "passed"
  }, null, 2));
}

main().catch((error) => {
  console.error("Module A verification failed:", error.message);
  process.exit(1);
});
