import { retrieveRelevantSections } from "../services/retriever.js";

async function inspectRAG() {
  const question = "A consumer purchased a mobile phone, but the phone was defective when delivered. What rights or remedies may the consumer have under the Consumer Protection Act, 2019?";

  console.log("==================================================================");
  console.log("🔍 LEXAGENT RAG INSPECTOR");
  console.log("==================================================================");
  console.log(`USER QUESTION:\n"${question}"\n`);

  console.log("==================================================================");
  console.log("1. CHROMADB RETRIEVAL (Top 3 Chunks)");
  console.log("==================================================================\n");

  const relevantSections = await retrieveRelevantSections(question, 3);

  relevantSections.forEach((chunk, i) => {
    console.log(`--- [CHUNK #${i + 1}] ---`);
    console.log(`Act      : ${chunk.metadata.act}`);
    console.log(`Section  : ${chunk.metadata.section}`);
    console.log(`Title    : ${chunk.metadata.title}`);
    console.log(`Page     : ${chunk.metadata.page}`);
    console.log(`Source   : ${chunk.metadata.source}`);
    console.log(`Score    : ${chunk.score}`);
    console.log(`FULL TEXT:\n${chunk.text}`);
    console.log("------------------------------------------------------------------\n");
  });

  const formattedContext = relevantSections
    .map((r) => `[${r.metadata.section} - ${r.metadata.title} (Page ${r.metadata.page})]\n${r.text}`)
    .join("\n\n");

  console.log("==================================================================");
  console.log("2. CONTEXT PASSED TO AGENTS (supportAgent, opposeAgent, judgeAgent)");
  console.log("==================================================================");
  console.log(formattedContext);
  console.log("==================================================================\n");
}

inspectRAG();
