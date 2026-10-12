import fs from "fs";
import path from "path";

const NORMALIZED_PRECEDENTS_PATH = path.resolve("./data/normalized/precedents.json");
const NORMALIZED_STATUTES_PATH = path.resolve("./data/normalized/statutes.json");
const LEGACY_JUDGMENTS_PATH = path.resolve("./data/consumer_protection_judgments.json");
const LEGACY_LEGISLATION_PATH = path.resolve("./data/primary_legislation_rules.json");

/**
 * Module 6: Grounding Validator & Source Traceability Interceptor.
 * Performs deterministic verification on legal citations, sections, rules, and precedents.
 * Checks against verified dataset records in normalized precedents.json and statutes.json.
 * 
 * @param {string} agentName "Support" | "Oppose" | "Judge"
 * @param {object} output Agent JSON response object
 * @param {string} context Raw retrieved context string
 * @returns {object} { sanitizedOutput: object, groundingReport: object }
 */
export function validateAgentOutput(agentName, output, context = "") {
  if (!output || typeof output !== "object") {
    return {
      valid: true,
      citation_errors: [],
      unsupported_claims: [],
      fabricated_sources: [],
      warnings: []
    };
  }

  const citationErrors = [];
  const unsupportedClaims = [];
  const fabricatedSources = [];
  const warnings = [];

  // Load verified database records for grounding lookup
  let verifiedJudgments = [];
  let verifiedLegislation = [];
  try {
    const precPath = fs.existsSync(NORMALIZED_PRECEDENTS_PATH) ? NORMALIZED_PRECEDENTS_PATH : LEGACY_JUDGMENTS_PATH;
    if (fs.existsSync(precPath)) {
      verifiedJudgments = JSON.parse(fs.readFileSync(precPath, "utf-8"));
    }

    const statPath = fs.existsSync(NORMALIZED_STATUTES_PATH) ? NORMALIZED_STATUTES_PATH : LEGACY_LEGISLATION_PATH;
    if (fs.existsSync(statPath)) {
      verifiedLegislation = JSON.parse(fs.readFileSync(statPath, "utf-8"));
    }
  } catch (err) {
    console.warn("⚠️ Grounding dataset loading warning:", err.message);
  }

  const validJudgmentNames = new Set(
    verifiedJudgments.map((j) => {
      const name = (j.metadata && j.metadata.case_name) || j.case_name || "";
      return name.toLowerCase().trim();
    })
  );

  const validCitations = new Set(
    verifiedJudgments.map((j) => {
      const cit = (j.metadata && j.metadata.citation) || j.citation || "";
      return cit.toLowerCase().trim();
    })
  );

  const validSections = new Set(
    verifiedLegislation.map((record) => {
      const metadata = record.metadata || {};
      return (metadata.section_or_rule || record.section_or_rule || "").toLowerCase().trim();
    }).filter(Boolean)
  );

  // 1. Audit Precedents
  const precedentsList = output.supporting_precedents || output.contrary_precedents || output.precedents_considered || [];
  if (Array.isArray(precedentsList)) {
    precedentsList.forEach((p) => {
      if (p.case_name) {
        const nameLower = p.case_name.toLowerCase().trim();
        const isValid = validJudgmentNames.has(nameLower) || Array.from(validJudgmentNames).some((v) => v.includes(nameLower.substring(0, 15)));
        if (!isValid) {
          fabricatedSources.push(`Unverified Precedent Case Name: "${p.case_name}" not found in verified judgments dataset.`);
        }
      }
      if (p.citation) {
        const citLower = p.citation.toLowerCase().trim();
        const isValid = validCitations.has(citLower) || Array.from(validCitations).some((v) => v.includes(citLower));
        if (!isValid) {
          citationErrors.push(`Unverified Case Citation: "${p.citation}" not found in authoritative records.`);
        }
      }
    });
  }

  // 2. Audit Statutory Sections
  const sectionsList = output.applicable_sections || [];
  if (Array.isArray(sectionsList)) {
    sectionsList.forEach((s) => {
      if (s.section) {
        const sectionLower = s.section.toLowerCase().trim();
        if (!validSections.has(sectionLower)) {
          citationErrors.push(`Unknown Statutory Section: "${s.section}" not found in normalized statutes.`);
        } else if (!context.toLowerCase().includes(sectionLower)) {
          warnings.push(`Statutory Section '${s.section}' cited by ${agentName} was not directly present in retrieved text chunks.`);
        }
      }
    });
  }

  // 3. Audit Unsupported Claims vs Context
  if (output.arguments && Array.isArray(output.arguments)) {
    output.arguments.forEach((arg) => {
      if (arg.argument && arg.argument.includes("misused") && !context.toLowerCase().includes("misused")) {
        unsupportedClaims.push(`Unsupported claim: 'misused' mentioned without factual context proof.`);
      }
    });
  }

  const isValid = citationErrors.length === 0 && fabricatedSources.length === 0;

  const groundingReport = {
    valid: isValid,
    citation_errors: citationErrors,
    unsupported_claims: unsupportedClaims,
    fabricated_sources: fabricatedSources,
    warnings: warnings
  };

  if (!isValid) {
    console.warn(`🛡️ GROUNDING AUDIT WARNING [${agentName}]: Citation/Fabrication errors detected:`, JSON.stringify(groundingReport, null, 2));
  } else {
    console.log(`🛡️ GROUNDING AUDIT PASSED [${agentName}]: 0 Citation Errors, 0 Fabricated Sources.`);
  }

  // Attach grounding report to output object
  const sanitized = JSON.parse(JSON.stringify(output));
  sanitized.grounding_report = groundingReport;

  return sanitized;
}
