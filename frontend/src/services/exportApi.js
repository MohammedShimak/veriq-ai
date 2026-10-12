import axios from "axios";
import { API_HOST } from "../config/apiConfig";

const API_BASE = `${API_HOST}/export`;

function getAuthHeaders(token = null, threadId = null) {
  const headers = {};
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

export async function downloadVerdictPDF(threadId, turnIndex = 0, token = null) {
  const headers = getAuthHeaders(token, threadId);
  const response = await axios.get(`${API_BASE}/pdf/${threadId}/${turnIndex}`, {
    headers,
    responseType: "blob"
  });

  const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `LexAgent_Verdict_${threadId}_Turn${turnIndex + 1}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function getCitationGraphApi(threadId, token = null) {
  const headers = getAuthHeaders(token, threadId);
  const res = await axios.get(`${API_BASE}/citation-graph/${threadId}`, { headers });
  return res.data;
}
