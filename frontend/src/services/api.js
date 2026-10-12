import axios from "axios";
import { API_HOST } from "../config/apiConfig";

const API = axios.create({
  baseURL: API_HOST
});

/**
 * Streams debate events from backend SSE via POST fetch.
 * Explicitly reads error JSON payload on non-200 responses to display accurate error messages.
 * 
 * @param {string} question 
 * @param {string|null} threadId 
 * @param {function} onEvent (eventType, data) => void
 * @param {function} onError (errorMessage) => void
 * @param {function} onComplete () => void
 */
export async function streamDebate(question, threadId, onEvent, onError, onComplete, token = null) {
  const targetUrl = `${API_HOST}/debate`;

  const authToken = token || localStorage.getItem("accessToken") || localStorage.getItem("lexagent_token");
  const headers = {
    "Content-Type": "application/json"
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  let response = null;
  try {
    response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ question, threadId })
    });
  } catch (err) {
    console.warn(`Fetch connection error for ${targetUrl}:`, err.message);
    if (onError) onError(`Unable to reach backend server at ${targetUrl}. Please ensure backend server is online.`);
    return;
  }

  if (!response) {
    if (onError) onError("No response received from backend server.");
    return;
  }

  if (!response.ok) {
    let serverErrText = "";
    try {
      const errJson = await response.json();
      serverErrText = errJson.error || errJson.message || JSON.stringify(errJson);
    } catch (e) {
      serverErrText = await response.text();
    }
    if (onError) onError(`Server Error (${response.status}): ${serverErrText || "Processing failed"}`);
    return;
  }

  try {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || ""; // retain trailing incomplete chunk

      for (const block of blocks) {
        if (!block.trim()) continue;

        let eventType = "message";
        let eventData = {};

        const lines = block.split("\n");
        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            const rawData = line.slice(5).trim();
            try {
              eventData = JSON.parse(rawData);
            } catch (e) {
              eventData = rawData;
            }
          }
        }

        if (eventType === "error") {
          if (onError) onError(eventData.message || "Server processing error");
        } else if (eventType === "done") {
          if (onComplete) onComplete();
        } else {
          if (onEvent) onEvent(eventType, eventData);
        }
      }
    }

    if (onComplete) onComplete();
  } catch (err) {
    console.error("streamDebate error:", err);
    if (onError) onError(err.message);
  }
}

export default API;