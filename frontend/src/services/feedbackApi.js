import axios from "axios";
import { API_HOST } from "../config/apiConfig";

const API_BASE = `${API_HOST}/feedback`;

export async function submitFeedbackApi(threadId, turnIndex, rating, comment, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await axios.post(
    `${API_BASE}`,
    { threadId, turnIndex, rating, comment },
    { headers }
  );
  return res.data;
}

export async function getThreadFeedbackApi(threadId, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await axios.get(`${API_BASE}/${threadId}`, { headers });
  return res.data;
}

export async function getFeedbackSummaryApi(token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await axios.get(`${API_BASE}/stats/summary`, { headers });
  return res.data;
}
