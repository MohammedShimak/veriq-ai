import { retrieveRelevantSections } from "../services/retriever.js";
import { supportAgent } from "../agents/supportAgent.js";

async function main() {
  const question = "A consumer purchased a mobile phone, but the phone was defective when delivered. What rights or remedies may the consumer have under the Consumer Protection Act, 2019?";

  console.log("🔍 Fetching RAG context from ChromaDB...");
  const relevantSections = await retrieveRelevantSections(question, 3);

  const context = relevantSections
    .map((r) => `[${r.metadata.section} - ${r.metadata.title} (Page ${r.metadata.page})]\n${r.text}`)
    .join("\n\n");

  console.log("⚖ Executing Support Agent...\n");
  const output = await supportAgent(question, context);

  console.log("✅ TEST COMPLETE.");
}

main();
