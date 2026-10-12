import { generateVerdictPDF } from "../services/pdfGenerator.js";
import PDFDocument from "pdfkit";

describe("Module F: Verdict Export & Citation Graph Tests", () => {
  const mockThread = {
    threadId: "test_thread_pdf_001",
    category: "Defective Product",
    turns: [
      {
        question: "Defective mobile phone display failed within 3 days.",
        category: "Defective Product",
        support: {
          position: "Consumer entitled to replacement under Section 39.",
          arguments: [{ issue: "Defect", argument: "Display failure within 3 days." }]
        },
        oppose: {
          position: "Respondent invokes Section 87 product liability exceptions.",
          arguments: [{ issue: "User misuse", argument: "Display damage caused by drop." }]
        },
        judge: {
          decision: "🟢 Consumer case stronger",
          decision_explanation: "Failure occurred within 3 days post-delivery.",
          relief: ["Full refund of Rs. 25,000", "Litigation costs of Rs. 2,000"],
          overall_confidence: 0.85,
          sources: [
            { type: "STATUTE", title: "Consumer Protection Act, 2019", identifier: "Section 2(10)", verified: true },
            { type: "STATUTE", title: "Consumer Protection Act, 2019", identifier: "Section 39", verified: true }
          ]
        }
      }
    ]
  };

  test("Test case 1: generateVerdictPDF returns an instance of PDFDocument readable stream", () => {
    const docStream = generateVerdictPDF("test_thread_pdf_001", 0, mockThread);
    expect(docStream).toBeInstanceOf(PDFDocument);
  });

  test("Test case 2: generateVerdictPDF handles missing or minimal turn data gracefully", () => {
    const emptyThread = { threadId: "empty_thread", turns: [] };
    const docStream = generateVerdictPDF("empty_thread", 0, emptyThread);
    expect(docStream).toBeInstanceOf(PDFDocument);
  });
});
