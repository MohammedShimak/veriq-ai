import { retrieveRelevantSections } from "../services/retriever.js";
import { opposeAgent } from "../agents/opposeAgent.js";

async function main() {
  const question = "A consumer purchased a defective mobile phone. What remedies may be available under the Consumer Protection Act, 2019?";

  console.log("🔍 Fetching RAG context from ChromaDB...");
  const relevantSections = await retrieveRelevantSections(question, 3);

  const context = relevantSections
    .map((r) => `[${r.metadata.section} - ${r.metadata.title} (Page ${r.metadata.page})]\n${r.text}`)
    .join("\n\n");

  console.log("⚖ Executing Oppose Agent...\n");
  const output = await opposeAgent(question, context);

  console.log("✅ TEST COMPLETE.");
}

main();
