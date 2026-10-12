import { semanticValidate } from "../services/semanticValidator.js";

describe("semanticValidator Integration & Unit Tests", () => {
  const mockContext = `
[Section 2(10) - Definition of Defect]
Defect means any fault, imperfection or shortcoming in quality.
  `.trim();

  test("Test case 1: Agent output with 0 section citations -> expect total_claims_checked: 0", async () => {
    const mockOutput = {
      arguments: ["The product failed to turn on."]
    };

    const report = await semanticValidate("Support", mockOutput, mockContext);
    expect(report.total_claims_checked).toBe(0);
    expect(report.summary.entailed).toBe(0);
  });

  test("Test case 2: Section cited but missing from retrieved context -> expect unsupported verdict", async () => {
    const mockOutput = {
      arguments: ["The manufacturer invokes immunity under Section 87."]
    };

    const report = await semanticValidate("Oppose", mockOutput, mockContext);
    expect(report.total_claims_checked).toBe(1);
    expect(report.results[0].verdict).toBe("unsupported");
    expect(report.results[0].explanation).toContain("Section not present");
    expect(report.summary.unsupported).toBe(1);
  });
});
