import { retrieveRelevantSections } from "../services/retriever.js";

async function runAllTests() {
  const testQueries = [
    "A consumer purchased a defective mobile phone. What remedies may be available?",
    "A consumer ordered a product online but it was never delivered. What legal provisions may be relevant?",
    "What is a defect under the Consumer Protection Act, 2019?",
    "What are the rights of a consumer under the Consumer Protection Act, 2019?"
  ];

  console.log("\n==================================================================");
  console.log("🚀 LEXAGENT RAG RETRIEVAL SUITE (4 TEST CASES)");
  console.log("==================================================================\n");

  for (let i = 0; i < testQueries.length; i++) {
    console.log(`\n>>> EXECUTING TEST CASE [${i + 1}/${testQueries.length}] <<<`);
    await retrieveRelevantSections(testQueries[i], 3);
  }

  console.log("✅ ALL 4 RETRIEVAL TESTS COMPLETED.\n");
}

runAllTests().catch((err) => {
  console.error("❌ Error running retrieval test suite:", err);
});
