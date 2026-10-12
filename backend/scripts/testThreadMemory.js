import { runDebate } from "../services/orchestrator.js";
import { getThread, saveTurn } from "../services/threadService.js";
import crypto from "crypto";

async function main() {
  const threadId = crypto.randomUUID();
  console.log("==================================================");
  console.log(`TESTING MULTI-TURN THREAD MEMORY (Thread ID: ${threadId})`);
  console.log("==================================================\n");

  // TURN 1: Initial Question
  const turn1Question = "A consumer bought a defective laptop that stopped working after 3 days. The seller refused to refund.";
  console.log(`💬 TURN 1 QUESTION: "${turn1Question}"\n`);

  const turn1Result = await runDebate(turn1Question, "", null, []);

  await saveTurn(threadId, {
    question: turn1Question,
    retrievedContext: turn1Result.retrievedContext,
    support: turn1Result.support,
    oppose: turn1Result.oppose,
    judge: turn1Result.judge
  });

  console.log("✅ Turn 1 saved to MongoDB thread.\n");

  // Load thread history for Turn 2
  const existingThread = await getThread(threadId);
  const history = existingThread.turns.slice(-3);

  // TURN 2: Short Follow-Up Question
  const turn2Question = "What if the seller ignored my written complaint for over 6 months?";
  console.log("--------------------------------------------------");
  console.log(`💬 TURN 2 FOLLOW-UP QUESTION: "${turn2Question}"`);
  console.log(`📜 History Turns Passed to Engine: ${history.length}`);
  console.log("--------------------------------------------------\n");

  const turn2Result = await runDebate(turn2Question, "", null, history);

  await saveTurn(threadId, {
    question: turn2Question,
    retrievedContext: turn2Result.retrievedContext,
    support: turn2Result.support,
    oppose: turn2Result.oppose,
    judge: turn2Result.judge
  });

  console.log("==================================================");
  console.log("MULTI-TURN THREAD VERIFICATION COMPLETE");
  console.log("==================================================");
  console.log("TURN 2 JUDGE DECISION:\n", turn2Result.judge.decision);
  console.log("\nTURN 2 JUDGE APPLICATION:\n", turn2Result.judge.application);
  console.log("==================================================\n");
}

main().catch((err) => console.error("❌ Test failed:", err));
