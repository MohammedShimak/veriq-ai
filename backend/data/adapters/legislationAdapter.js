import fs from "fs";
import path from "path";
import { slugify, cleanText } from "./adapterUtils.js";

const LEGISLATION_PATH = path.resolve("./data/primary_legislation_rules.json");

/**
 * Adapter for primary legislation and statutory rules.
 * Maps CPA 2019 provisions to authority_level 1 (statute)
 * and subsidiary rules to authority_level 2 (rule).
 * 
 * @returns {{ statutes: Array, rules: Array }}
 */
export function loadLegislationAndRules() {
  if (!fs.existsSync(LEGISLATION_PATH)) {
    throw new Error(`Legislation file not found at: ${LEGISLATION_PATH}`);
  }

  const rawData = JSON.parse(fs.readFileSync(LEGISLATION_PATH, "utf-8"));
  const statutes = [];
  const rules = [];

  rawData.forEach((doc) => {
    const isStatute = doc.document_name.includes("Consumer Protection Act, 2019");

    if (doc.provisions && Array.isArray(doc.provisions)) {
      doc.provisions.forEach((prov) => {
        const cleanProvText = cleanText(prov.text);
        const sectionOrRule = prov.section_or_rule;
        const title = prov.title;
        const legalPurpose = prov.legal_purpose || "";

        if (isStatute) {
          const docId = `statute_cpa2019_${slugify(sectionOrRule)}`;
          statutes.push({
            doc_id: docId,
            source_type: "statute",
            title: `${sectionOrRule} - ${title}`,
            text: cleanProvText,
            tags: ["consumer protection act 2019", "statute", sectionOrRule, title, legalPurpose],
            jurisdiction: "India",
            authority_level: 1,
            verified: true,
            source_url: doc.source || "https://www.indiacode.nic.in/handle/123456789/15256",
            year: doc.year || 2019,
            metadata: {
              act_or_document_name: doc.document_name,
              section_or_rule: sectionOrRule,
              legal_purpose: legalPurpose
            }
          });
        } else {
          const docId = `rule_${slugify(doc.document_name)}_${slugify(sectionOrRule)}`;
          rules.push({
            doc_id: docId,
            source_type: "rule",
            title: `${doc.document_name} - ${sectionOrRule}: ${title}`,
            text: cleanProvText,
            tags: [doc.document_name, "rule", sectionOrRule, title, legalPurpose],
            jurisdiction: "India",
            authority_level: 2,
            verified: true,
            source_url: doc.source || "",
            year: doc.year || 2020,
            metadata: {
              act_or_document_name: doc.document_name,
              section_or_rule: sectionOrRule,
              legal_purpose: legalPurpose
            }
          });
        }
      });
    }
  });

  console.log(`📜 Loaded ${statutes.length} statutory section records and ${rules.length} rule records.`);
  return { statutes, rules };
}
