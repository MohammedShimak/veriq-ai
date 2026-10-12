import { extractClaimSentences } from "../utils/claimExtractor.js";

describe("claimExtractor Utility Tests", () => {
  test("Test case 1: Input with 3 sentences, 2 citing sections -> extracts exactly 2 claim sentences", () => {
    const mockOutput = {
      arguments: [
        {
          argument: "The product contains an inherent manufacturing defect under Section 2(10). The buyer reported the issue within 2 days. The District Commission has power to order replacement under Section 39."
        }
      ]
    };

    const results = extractClaimSentences(mockOutput);
    expect(results).toHaveLength(2);
    expect(results[0].sentence).toContain("Section 2(10)");
    expect(results[1].sentence).toContain("Section 39");
  });

  test("Test case 2: Input with no section references -> returns empty array", () => {
    const mockOutput = {
      position: "The consumer bought a defective item.",
      arguments: ["The seller refused to help and turned off customer support."]
    };

    const results = extractClaimSentences(mockOutput);
    expect(results).toHaveLength(0);
  });

  test("Test case 3: Input with Section 2(10) and Section 39 in the same sentence -> extracts both section references", () => {
    const mockOutput = {
      position: "The failure constitutes a defect under Section 2(10) requiring statutory replacement under Section 39."
    };

    const results = extractClaimSentences(mockOutput);
    expect(results).toHaveLength(1);
    expect(results[0].citedSections).toContain("Section 2(10)");
    expect(results[0].citedSections).toContain("Section 39");
  });

  test("Test case 4: Input with nested object structure -> correctly walks all string fields", () => {
    const mockOutput = {
      nested: {
        deeper: {
          reason: "This practice is prohibited as an unfair trade practice under Section 2(47)."
        }
      }
    };

    const results = extractClaimSentences(mockOutput);
    expect(results).toHaveLength(1);
    expect(results[0].sentence).toContain("Section 2(47)");
  });
});
