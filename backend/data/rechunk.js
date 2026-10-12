import fs from "fs";
import path from "path";

const NORMALIZED_DIR = path.resolve("./data/normalized");
const CHUNKS_OUTPUT_PATH = path.join(NORMALIZED_DIR, "chunks.json");

function runRechunking() {
  console.log("=========================================");
  console.log("LEXAGENT SECTION-LEVEL ATOMIC RECHUNKING");
  console.log("=========================================\n");

  const statutes = JSON.parse(fs.readFileSync(path.join(NORMALIZED_DIR, "statutes.json"), "utf-8"));
  const rules = JSON.parse(fs.readFileSync(path.join(NORMALIZED_DIR, "rules.json"), "utf-8"));
  const precedents = JSON.parse(fs.readFileSync(path.join(NORMALIZED_DIR, "precedents.json"), "utf-8"));
  const caseLaw = JSON.parse(fs.readFileSync(path.join(NORMALIZED_DIR, "case_law.json"), "utf-8"));

  const chunks = [];

  // 1. Statutes: Atomic self-contained section chunks
  statutes.forEach((doc) => {
    chunks.push({
      chunk_id: `chunk_${doc.doc_id}`,
      doc_id: doc.doc_id,
      text: doc.text,
      metadata: {
        source_type: doc.source_type,
        title: doc.title,
        act_or_document_name: doc.metadata.act_or_document_name,
        section_or_rule: doc.metadata.section_or_rule,
        legal_purpose: doc.metadata.legal_purpose,
        authority_level: doc.authority_level,
        verified: doc.verified,
        source_url: doc.source_url
      }
    });
  });

  // 2. Rules: Atomic self-contained rule chunks
  rules.forEach((doc) => {
    chunks.push({
      chunk_id: `chunk_${doc.doc_id}`,
      doc_id: doc.doc_id,
      text: doc.text,
      metadata: {
        source_type: doc.source_type,
        title: doc.title,
        act_or_document_name: doc.metadata.act_or_document_name,
        section_or_rule: doc.metadata.section_or_rule,
        legal_purpose: doc.metadata.legal_purpose,
        authority_level: doc.authority_level,
        verified: doc.verified,
        source_url: doc.source_url
      }
    });
  });

  // 3. Precedents: Semantic sub-chunks (Facts, Arguments, Holding)
  precedents.forEach((doc) => {
    const meta = doc.metadata;

    // Sub-chunk 1: Facts & Issues
    chunks.push({
      chunk_id: `chunk_${doc.doc_id}_facts`,
      doc_id: doc.doc_id,
      text: `${meta.case_name} (${meta.citation})\nCourt: ${meta.court}\nFacts: ${meta.facts}\nIssues: ${(meta.legal_issues || []).join("; ")}`,
      metadata: {
        source_type: doc.source_type,
        title: `${meta.case_name} - Facts & Issues`,
        case_name: meta.case_name,
        citation: meta.citation,
        court: meta.court,
        court_level: meta.court_level,
        facts_summary: meta.facts,
        consumer_supporting_principle: meta.consumer_supporting_principle,
        respondent_supporting_principle: meta.respondent_supporting_principle,
        decision: meta.decision,
        relief: meta.relief,
        authority_level: doc.authority_level,
        verified: doc.verified,
        source_url: doc.source_url
      }
    });

    // Sub-chunk 2: Arguments & Principles
    chunks.push({
      chunk_id: `chunk_${doc.doc_id}_arguments`,
      doc_id: doc.doc_id,
      text: `${meta.case_name} (${meta.citation})\nConsumer Position: ${meta.consumer_arguments}\nDefense Position: ${meta.opposite_party_arguments}\nConsumer Principle: ${meta.consumer_supporting_principle}\nRespondent Principle: ${meta.respondent_supporting_principle}`,
      metadata: {
        source_type: doc.source_type,
        title: `${meta.case_name} - Adversarial Principles`,
        case_name: meta.case_name,
        citation: meta.citation,
        court: meta.court,
        court_level: meta.court_level,
        facts_summary: meta.facts,
        consumer_supporting_principle: meta.consumer_supporting_principle,
        respondent_supporting_principle: meta.respondent_supporting_principle,
        decision: meta.decision,
        relief: meta.relief,
        authority_level: doc.authority_level,
        verified: doc.verified,
        source_url: doc.source_url
      }
    });

    // Sub-chunk 3: Court Holding & Relief
    chunks.push({
      chunk_id: `chunk_${doc.doc_id}_holding`,
      doc_id: doc.doc_id,
      text: `${meta.case_name} (${meta.citation})\nCourt Reasoning: ${meta.court_reasoning}\nDecision: ${meta.decision}\nRelief Awarded: ${meta.relief}`,
      metadata: {
        source_type: doc.source_type,
        title: `${meta.case_name} - Holding & Relief`,
        case_name: meta.case_name,
        citation: meta.citation,
        court: meta.court,
        court_level: meta.court_level,
        facts_summary: meta.facts,
        consumer_supporting_principle: meta.consumer_supporting_principle,
        respondent_supporting_principle: meta.respondent_supporting_principle,
        decision: meta.decision,
        relief: meta.relief,
        authority_level: doc.authority_level,
        verified: doc.verified,
        source_url: doc.source_url
      }
    });
  });

  // 4. Case Law / Secondary QA: Truncated clean chunks
  caseLaw.forEach((doc) => {
    chunks.push({
      chunk_id: `chunk_${doc.doc_id}`,
      doc_id: doc.doc_id,
      text: doc.text.slice(0, 2500),
      metadata: {
        source_type: doc.source_type,
        title: doc.title,
        case_name: doc.metadata.case_name,
        court: doc.metadata.court,
        legal_provisions: doc.metadata.legal_provisions,
        authority_level: doc.authority_level,
        verified: doc.verified,
        source_dataset: doc.metadata.source_dataset,
        source_url: doc.source_url
      }
    });
  });

  fs.writeFileSync(CHUNKS_OUTPUT_PATH, JSON.stringify(chunks, null, 2), "utf-8");
  console.log(`✅ Generated ${chunks.length} section-level atomic & semantic chunks at ${CHUNKS_OUTPUT_PATH}`);
  console.log("=========================================\n");
}

try {
  runRechunking();
} catch (err) {
  console.error("🛑 Error in rechunking:", err);
  process.exit(1);
}
