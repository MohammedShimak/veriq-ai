import { Feedback } from "../models/Feedback.js";
import { Thread } from "../models/Thread.js";

describe("Module E: Feedback Loop Models & Validation Tests", () => {
  test("Test case 1: Feedback schema validation requires rating 'up' or 'down'", () => {
    const validUp = new Feedback({
      threadId: "thread_123",
      turnIndex: 0,
      userId: "64b0f0000000000000000001",
      rating: "up",
      comment: "Accurate verdict"
    });
    expect(validUp.validateSync()).toBeUndefined();

    const invalidRating = new Feedback({
      threadId: "thread_123",
      turnIndex: 0,
      userId: "64b0f0000000000000000001",
      rating: "neutral"
    });
    const err = invalidRating.validateSync();
    expect(err.errors.rating).toBeDefined();
  });

  test("Test case 2: Feedback schema enforces maxlength 500 on comment", () => {
    const longComment = "a".repeat(501);
    const feedback = new Feedback({
      threadId: "thread_123",
      turnIndex: 0,
      userId: "64b0f0000000000000000001",
      rating: "down",
      comment: longComment
    });

    const err = feedback.validateSync();
    expect(err.errors.comment).toBeDefined();
  });

  test("Test case 3: Thread model includes category and judgeConfidence on turns", () => {
    const thread = new Thread({
      threadId: "test_thread_001",
      category: "Defective Product",
      turns: [
        {
          question: "Defective laptop screen",
          category: "Defective Product",
          judgeConfidence: 0.85,
          support: { position: "Consumer entitlement" },
          oppose: { position: "No defect" },
          judge: { decision: "🟢 Consumer case stronger", overall_confidence: 0.85 }
        }
      ]
    });

    expect(thread.turns[0].category).toBe("Defective Product");
    expect(thread.turns[0].judgeConfidence).toBe(0.85);
  });
});
