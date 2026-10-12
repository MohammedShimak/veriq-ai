import axios from "axios";
import { API_HOST } from "../config/apiConfig";

const API_BASE = `${API_HOST}/history`;

export async function getThreadsApi(token) {
  const res = await axios.get(`${API_BASE}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
}

export async function getThreadApi(threadId, token) {
  const res = await axios.get(`${API_BASE}/${threadId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
}

export async function deleteThreadApi(threadId, token) {
  const res = await axios.delete(`${API_BASE}/${threadId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
}

export async function getUserStatsApi(token) {
  const res = await axios.get(`${API_BASE}/stats`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
}
