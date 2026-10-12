import { runDebate } from "../services/orchestrator.js";

async function main() {
  const question = "I bought a laptop, but it stopped working within a few days. The seller refused to replace it or refund my money. What rights and remedies do I have under the Consumer Protection Act, 2019?";
  
  console.log("Executing live debate query...\n");
  const result = await runDebate(question);
  console.log("==================================================");
  console.log("LIVE DEBATE OUTPUT RESULT");
  console.log("==================================================");
  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => console.error("Error:", err));
