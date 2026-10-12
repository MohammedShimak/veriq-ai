import axios from "axios";
import { API_HOST } from "../config/apiConfig";

const API_BASE = `${API_HOST}/investigation`;

function getHeaders(token = null, threadId = null) {
  const headers = { "Content-Type": "application/json" };
  const activeToken = token || localStorage.getItem("accessToken") || localStorage.getItem("lexagent_token");
  if (activeToken) {
    headers["Authorization"] = `Bearer ${activeToken}`;
  } else if (threadId) {
    const guestToken = localStorage.getItem(`needhiai_guest_${threadId}`);
    if (guestToken) {
      headers["x-guest-token"] = guestToken;
    }
  }
  return headers;
}

/**
 * Creates a persistent investigation case record before any judgment exists.
 */
export async function createInvestigationApi(data, token = null) {
  const res = await axios.post(API_BASE, data, {
    headers: getHeaders(token)
  });
  if (res.data && res.data.guestToken && res.data.investigation?.threadId) {
    try {
      localStorage.setItem(`needhiai_guest_${res.data.investigation.threadId}`, res.data.guestToken);
    } catch (e) {
      console.warn("Could not persist guest token to localStorage:", e);
    }
  }
  return res.data;
}

/**
 * Retrieves an investigation by threadId, enforcing user isolation.
 */
export async function getInvestigationApi(threadId, token = null) {
  const res = await axios.get(`${API_BASE}/${threadId}`, {
    headers: getHeaders(token, threadId)
  });
  return res.data;
}

/**
 * Triggers initial structured analysis and first-round dynamic question generation.
 */
export async function analyzeInvestigationApi(threadId, token = null) {
  const res = await axios.post(`${API_BASE}/${threadId}/analyze`, {}, {
    headers: getHeaders(token, threadId)
  });
  return res.data;
}

/**
 * Submits user clarification answers (batch or single) and fetches next round if needed.
 */
export async function submitClarificationAnswersApi(threadId, answers, token = null) {
  const res = await axios.post(
    `${API_BASE}/${threadId}/answers`,
    { answers },
    { headers: getHeaders(token, threadId) }
  );
  return res.data;
}

/**
 * Explicitly stops questioning and proceeds to evidence collection.
 */
export async function proceedInvestigationApi(threadId, token = null) {
  const res = await axios.post(`${API_BASE}/${threadId}/proceed`, {}, {
    headers: getHeaders(token, threadId)
  });
  return res.data;
}

/**
 * PHASE 3: Uploads and inspects evidence document (base64 payload).
 */
export async function uploadEvidenceApi(threadId, payload, token = null) {
  const res = await axios.post(`${API_BASE}/${threadId}/evidence/upload`, payload, {
    headers: getHeaders(token, threadId)
  });
  return res.data;
}

/**
 * PHASE 3: Marks requested evidence as unavailable.
 */
export async function markEvidenceUnavailableApi(threadId, evidenceId, reason, token = null) {
  const res = await axios.post(
    `${API_BASE}/${threadId}/evidence/${encodeURIComponent(evidenceId)}/unavailable`,
    { reason },
    { headers: getHeaders(token, threadId) }
  );
  return res.data;
}

/**
 * PHASE 3: Submits user correction to document interpretation without modifying file.
 */
export async function submitEvidenceCorrectionApi(threadId, evidenceId, correctionData, token = null) {
  const res = await axios.post(
    `${API_BASE}/${threadId}/evidence/${encodeURIComponent(evidenceId)}/correction`,
    correctionData,
    { headers: getHeaders(token, threadId) }
  );
  return res.data;
}

/**
 * PHASE 3: Removes an evidence document from the investigation inventory.
 */
export async function removeEvidenceApi(threadId, evidenceId, token = null) {
  const res = await axios.delete(
    `${API_BASE}/${threadId}/evidence/${encodeURIComponent(evidenceId)}`,
    { headers: getHeaders(token, threadId) }
  );
  return res.data;
}

/**
 * PHASE 3: Explains document relevance or confirms it is unrelated.
 */
export async function clarifyEvidenceRelevanceApi(threadId, evidenceId, payload, token = null) {
  const res = await axios.post(
    `${API_BASE}/${threadId}/evidence/${encodeURIComponent(evidenceId)}/relevance`,
    payload,
    { headers: getHeaders(token, threadId) }
  );
  return res.data;
}

/**
 * PHASE 3: Gets secure evidence download URL with proper authorization headers.
 */
export async function downloadEvidenceFileApi(threadId, evidenceId, token = null) {
  const res = await axios.get(
    `${API_BASE}/${threadId}/evidence/${encodeURIComponent(evidenceId)}/file`,
    {
      headers: getHeaders(token, threadId),
      responseType: "blob"
    }
  );
  return res.data;
}

/**
 * PHASE 4: Triggers company policy research.
 */
export async function researchCompanyPolicyApi(threadId, token = null) {
  const res = await axios.post(
    `${API_BASE}/${threadId}/research`,
    {},
    { headers: getHeaders(token, threadId) }
  );
  return res.data;
}

/**
 * PHASE 4: Retrieves company policy research.
 */
export async function getCompanyPolicyResearchApi(threadId, token = null) {
  const res = await axios.get(
    `${API_BASE}/${threadId}/research`,
    { headers: getHeaders(token, threadId) }
  );
  return res.data;
}

/**
 * PHASE 5: Evaluates completeness gate server-side.
 */
export async function evaluateInvestigationGateApi(threadId, token = null) {
  const res = await axios.post(
    `${API_BASE}/${threadId}/gate/evaluate`,
    {},
    { headers: getHeaders(token, threadId) }
  );
  return res.data;
}

/**
 * PHASE 5: Confirms proceeding with limitations despite missing documents.
 */
export async function proceedGateWithLimitationsApi(threadId, overrideReason, token = null) {
  const res = await axios.post(
    `${API_BASE}/${threadId}/gate/proceed`,
    { overrideReason },
    { headers: getHeaders(token, threadId) }
  );
  return res.data;
}

/**
 * PHASE 6: Generates grounded legal assessment under CPA 2019 after gate readiness check.
 */
export async function generateAssessmentApi(threadId, token = null) {
  const res = await axios.post(
    `${API_BASE}/${threadId}/assessment`,
    {},
    { headers: getHeaders(token, threadId) }
  );
  return res.data;
}

/**
 * PHASE 6: Retrieves existing legal assessment.
 */
export async function getAssessmentApi(threadId, token = null) {
  const res = await axios.get(
    `${API_BASE}/${threadId}/assessment`,
    { headers: getHeaders(token, threadId) }
  );
  return res.data;
}

/**
 * PHASE 7: Downloads comprehensive investigation report PDF.
 */
export async function downloadInvestigationPdfApi(threadId, token = null) {
  const res = await axios.get(
    `${API_BASE}/${threadId}/export/pdf`,
    {
      headers: getHeaders(token, threadId),
      responseType: "blob"
    }
  );
  return res.data;
}

/**
 * CONSUMER HELP HUB API CLIENTS
 */
const HELP_HUB_BASE = `${API_HOST}/help-hub`;

export async function getHelpHubIntentsApi() {
  const res = await axios.get(`${HELP_HUB_BASE}/intents`);
  return res.data;
}

export async function getHelpHubCategoriesApi() {
  const res = await axios.get(`${HELP_HUB_BASE}/categories`);
  return res.data;
}

export async function getHelpHubProceduralApi() {
  const res = await axios.get(`${HELP_HUB_BASE}/procedural`);
  return res.data;
}

export async function generateHelpHubDraftApi(payload) {
  const res = await axios.post(`${HELP_HUB_BASE}/draft`, payload);
  return res.data;
}

export async function searchHelpHubApi(query) {
  const res = await axios.post(`${HELP_HUB_BASE}/search`, { query });
  return res.data;
}

// ==========================================
// TAI (CENTRAL AI) ORCHESTRATION APIS
// ==========================================

export async function getTaiPlanApi(threadId, guestToken = null) {
  const headers = {};
  if (guestToken) headers["x-guest-token"] = guestToken;
  const res = await axios.get(`${API_BASE}/${threadId}/tai/plan`, { headers });
  return res.data;
}

export async function executeTaiStepApi(threadId, action, params = {}, guestToken = null) {
  const headers = {};
  if (guestToken) headers["x-guest-token"] = guestToken;
  const res = await axios.post(
    `${API_BASE}/${threadId}/tai/step`,
    { action, params },
    { headers }
  );
  return res.data;
}

// ==========================================
// AI 2.0 TRANSFER ASSESSMENT FORM APIS
// ==========================================

export async function getTransferAssessmentApi(threadId, token = null) {
  const res = await axios.get(
    `${API_BASE}/${threadId}/transfer-assessment`,
    { headers: getHeaders(token, threadId) }
  );
  return res.data;
}

export async function submitTransferAssessmentReviewApi(threadId, corrections = {}, confirmedByConsumer = true, token = null) {
  const res = await axios.put(
    `${API_BASE}/${threadId}/transfer-assessment`,
    { corrections, confirmedByConsumer },
    { headers: getHeaders(token, threadId) }
  );
  return res.data;
}

// ==========================================
// FINAL CASE OUTCOME APIS
// ==========================================

export async function generateFinalOutcomeApi(threadId, token = null) {
  const res = await axios.post(
    `${API_BASE}/${threadId}/final-outcome`,
    {},
    { headers: getHeaders(token, threadId) }
  );
  return res.data;
}

export async function getFinalOutcomeApi(threadId, token = null) {
  const res = await axios.get(
    `${API_BASE}/${threadId}/final-outcome`,
    { headers: getHeaders(token, threadId) }
  );
  return res.data;
}

export async function downloadFinalOutcomePdfApi(threadId, token = null) {
  const res = await axios.get(
    `${API_BASE}/${threadId}/final-outcome/export/pdf`,
    {
      headers: getHeaders(token, threadId),
      responseType: "blob"
    }
  );
  return res.data;
}


