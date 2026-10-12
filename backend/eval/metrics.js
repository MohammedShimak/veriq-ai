/**
 * Normalizes outcome string for comparison.
 */
function normalizeOutcome(str = "") {
  const clean = str.toLowerCase().trim();
  if (clean.includes("consumer") || clean.includes("allowed") || clean.includes("support")) {
    return "Consumer Wins";
  }
  if (clean.includes("respondent") || clean.includes("dismissed") || clean.includes("oppose")) {
    return "Respondent Wins";
  }
  return "Inconclusive";
}

/**
 * Computes complete evaluation metrics for predictions against ground truth.
 * 
 * @param {Array} results Array of evaluation result records
 * @returns {object} Calculated metrics object
 */
export function computeMetrics(results = []) {
  if (!results || results.length === 0) {
    return {
      total_cases: 0,
      outcome_accuracy: 0,
      category_accuracy: {},
      section_precision: 0,
      section_recall: 0,
      section_f1: 0,
      hallucination_rate: 0,
      ece: 0,
      avg_confidence: 0,
      semantic_grounding: {
        total_claims_checked: 0,
        entailment_rate: 0,
        contradiction_rate: 0,
        unsupported_rate: 0
      }
    };
  }

  const total = results.length;
  let correctCount = 0;
  const categoryStats = {};

  let totalPrecision = 0;
  let totalRecall = 0;
  let totalF1 = 0;
  let totalHallucinatedCitations = 0;
  let totalCitations = 0;
  let sumConfidence = 0;

  // ECE Bins (10 bins: 0.0-0.1 to 0.9-1.0)
  const bins = Array.from({ length: 10 }, () => ({ count: 0, sumConf: 0, correct: 0 }));

  // Semantic grounding counters
  let totalClaimsChecked = 0;
  let totalEntailed = 0;
  let totalContradicted = 0;
  let totalUnsupported = 0;

  results.forEach((item) => {
    const groundOutcome = normalizeOutcome(item.ground_truth?.outcome);
    const predOutcome = normalizeOutcome(item.prediction?.predicted_outcome);

    const isCorrect = groundOutcome === predOutcome;
    if (isCorrect) correctCount++;

    // Category accuracy
    const cat = item.category || "General Consumer Law";
    if (!categoryStats[cat]) {
      categoryStats[cat] = { total: 0, correct: 0 };
    }
    categoryStats[cat].total++;
    if (isCorrect) categoryStats[cat].correct++;

    // Section Precision / Recall / F1
    const predSections = new Set((item.prediction?.predicted_sections || []).map((s) => s.toLowerCase().trim()));
    const trueSections = new Set((item.ground_truth?.sections_invoked || []).map((s) => s.toLowerCase().trim()));

    if (predSections.size > 0 && trueSections.size > 0) {
      let intersection = 0;
      predSections.forEach((s) => {
        if (trueSections.has(s) || Array.from(trueSections).some((t) => t.includes(s) || s.includes(t))) {
          intersection++;
        }
      });

      const precision = intersection / predSections.size;
      const recall = intersection / trueSections.size;
      const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

      totalPrecision += precision;
      totalRecall += recall;
      totalF1 += f1;
    }

    // Citation Hallucinations (Layer 1 audit)
    const layer1Support = item.grounding_reports?.support_layer1 || {};
    const layer1Oppose = item.grounding_reports?.oppose_layer1 || {};
    const hallucinations = (layer1Support.fabricated_sources || []).length + (layer1Oppose.fabricated_sources || []).length;
    
    totalCitations += predSections.size || 1;
    totalHallucinatedCitations += hallucinations;

    // Confidence & ECE Binning
    const conf = typeof item.prediction?.confidence === "number" ? item.prediction.confidence : 0.70;
    sumConfidence += conf;

    const binIndex = Math.min(9, Math.floor(conf * 10));
    bins[binIndex].count++;
    bins[binIndex].sumConf += conf;
    if (isCorrect) bins[binIndex].correct++;

    // Module C Semantic Grounding aggregation
    const suppSem = item.grounding_reports?.support_semantic?.summary || {};
    const oppSem = item.grounding_reports?.oppose_semantic?.summary || {};

    totalClaimsChecked += (suppSem.entailed || 0) + (suppSem.contradicted || 0) + (suppSem.unsupported || 0) +
                          (oppSem.entailed || 0) + (oppSem.contradicted || 0) + (oppSem.unsupported || 0);
    totalEntailed += (suppSem.entailed || 0) + (oppSem.entailed || 0);
    totalContradicted += (suppSem.contradicted || 0) + (oppSem.contradicted || 0);
    totalUnsupported += (suppSem.unsupported || 0) + (oppSem.unsupported || 0);
  });

  // Calculate ECE
  let ece = 0;
  bins.forEach((b) => {
    if (b.count > 0) {
      const avgBinConf = b.sumConf / b.count;
      const avgBinAcc = b.correct / b.count;
      ece += (b.count / total) * Math.abs(avgBinConf - avgBinAcc);
    }
  });

  const categoryAccuracy = {};
  Object.keys(categoryStats).forEach((cat) => {
    categoryAccuracy[cat] = Number((categoryStats[cat].correct / categoryStats[cat].total).toFixed(4));
  });

  return {
    total_cases: total,
    outcome_accuracy: Number((correctCount / total).toFixed(4)),
    category_accuracy: categoryAccuracy,
    section_precision: Number((totalPrecision / total).toFixed(4)),
    section_recall: Number((totalRecall / total).toFixed(4)),
    section_f1: Number((totalF1 / total).toFixed(4)),
    hallucination_rate: Number((totalHallucinatedCitations / Math.max(1, totalCitations)).toFixed(4)),
    ece: Number(ece.toFixed(4)),
    avg_confidence: Number((sumConfidence / total).toFixed(4)),
    semantic_grounding: {
      total_claims_checked: totalClaimsChecked,
      entailment_rate: totalClaimsChecked > 0 ? Number((totalEntailed / totalClaimsChecked).toFixed(4)) : 0,
      contradiction_rate: totalClaimsChecked > 0 ? Number((totalContradicted / totalClaimsChecked).toFixed(4)) : 0,
      unsupported_rate: totalClaimsChecked > 0 ? Number((totalUnsupported / totalClaimsChecked).toFixed(4)) : 0
    }
  };
}
