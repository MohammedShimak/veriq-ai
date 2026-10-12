import { runDebate } from "../services/orchestrator.js";

async function main() {
  const inScopeQ = "A consumer purchased a defective refrigerator that stopped working within 2 days. The store refused to refund or replace it. What remedies are available under the Consumer Protection Act, 2019?";
  const outOfScopeQ = "What is the legal punishment for criminal murder and robbery under the Indian Penal Code?";

  console.log("==================================================");
  console.log("TEST 1: IN-SCOPE QUESTION (Defective Product Refund)");
  console.log(`"${inScopeQ}"`);
  console.log("==================================================\n");

  const inScopeResult = await runDebate(inScopeQ);

  console.log("\n==================================================");
  console.log("TEST 2: OUT-OF-SCOPE QUESTION (Criminal IPC Matter)");
  console.log(`"${outOfScopeQ}"`);
  console.log("==================================================\n");

  const outOfScopeResult = await runDebate(outOfScopeQ);

  console.log("==================================================");
  console.log("CLASSIFIER & DOMAIN SCOPE VERIFICATION RESULT");
  console.log("==================================================");
  console.log("IN-SCOPE RESULT:\n", JSON.stringify(inScopeResult, null, 2));
  console.log("\n--------------------------------------------------\n");
  console.log("OUT-OF-SCOPE RESULT (Short-Circuited Response):\n", JSON.stringify(outOfScopeResult, null, 2));
  console.log("==================================================\n");
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
});
