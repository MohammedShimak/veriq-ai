import { findRetrievedTextForSection } from "../utils/sectionMatcher.js";

describe("sectionMatcher Utility Tests", () => {
  const mockContext = `
[Section 2(10) - Definition of Defect]
Defect means any fault, imperfection or shortcoming in the quality, quantity, potency, purity or standard which is required to be maintained by or under any law for the time being in force.

[Section 39 - Findings of District Commission]
Where the District Commission is satisfied that the goods complained against suffer from any of the defects specified in the complaint, it shall issue an order directing replacement or price refund.
  `.trim();

  test("Test case 1: Section reference present in context -> returns surrounding text snippet", () => {
    const snippet = findRetrievedTextForSection("Section 2(10)", mockContext);
    expect(snippet).not.toBeNull();
    expect(snippet).toContain("Definition of Defect");
  });

  test("Test case 2: Section reference not present -> returns null", () => {
    const snippet = findRetrievedTextForSection("Section 87", mockContext);
    expect(snippet).toBeNull();
  });

  test("Test case 3: Main section fallback matching -> extracts surrounding context window", () => {
    const snippet = findRetrievedTextForSection("Section 39(1)(b)", mockContext);
    expect(snippet).not.toBeNull();
    expect(snippet).toContain("Section 39");
  });
});
