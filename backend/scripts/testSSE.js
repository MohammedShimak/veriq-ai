import { streamDebate } from "../../frontend/src/services/api.js";

async function main() {
  console.log("==================================================");
  console.log("TESTING LIVE SERVER-SENT EVENTS (SSE) STREAMING");
  console.log("==================================================\n");

  const question = "I bought a defective laptop that stopped working within 3 days. The seller refused to refund my money. What rights do I have?";
  const startTime = Date.now();

  const getElapsedMs = () => `+${((Date.now() - startTime) / 1000).toFixed(2)}s`;

  console.log(`[${getElapsedMs()}] Sending POST request to http://localhost:5000/api/debate...`);

  await streamDebate(
    question,
    null,
    (eventType, data) => {
      console.log(`\n⚡ [${getElapsedMs()}] SSE EVENT RECEIVED: "${eventType}"`);
      if (eventType === "thread") {
        console.log(`   Thread ID: ${data.threadId}`);
      } else if (eventType === "intent") {
        console.log(`   Category: ${data.category} (Confidence: ${data.confidence}%)`);
      } else if (eventType === "support") {
        console.log(`   Support Position: "${data.position?.substring(0, 80)}..."`);
        console.log(`   Support Claim Strength: ${data.strength}%`);
      } else if (eventType === "oppose") {
        console.log(`   Oppose Position: "${data.position?.substring(0, 80)}..."`);
        console.log(`   Oppose Defense Strength: ${data.strength}%`);
      } else if (eventType === "judge") {
        console.log(`   Winning Side: ${data.winningSide} (Confidence: ${data.confidence}%)`);
        console.log(`   Judge Verdict: "${data.decision?.substring(0, 90)}..."`);
      }
    },
    (err) => {
      console.error(`❌ [${getElapsedMs()}] Stream Error:`, err);
    },
    () => {
      console.log(`\n✅ [${getElapsedMs()}] STREAM COMPLETED (Stream closed cleanly)`);
      console.log("==================================================\n");
    }
  );
}

main().catch(err => console.error("Test Error:", err));
