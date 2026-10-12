/**
 * debateApi.js — SSE Stream Client for LexAgent Multi-Agent Debate
 * 
 * @param {string} question User dispute query
 * @param {string} threadId Optional threadId for continuing case turns
 * @param {string} token JWT access token
 * @param {function} onEvent Callback function (eventType, data)
 * @returns {function} Abort controller cleanup function
 */
export function startDebateStream(question, threadId, token, onEvent, extraData = {}) {
  const controller = new AbortController();

  async function fetchStream() {
    try {
      const headers = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("http://localhost:5000/api/debate", {
        method: "POST",
        headers,
        body: JSON.stringify({ question, threadId, ...extraData }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Stream connection failed" }));
        onEvent("error", errorData);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          let eventName = "message";
          let dataStr = "";

          const eventMatch = line.match(/^event:\s*(.+)$/m);
          if (eventMatch) eventName = eventMatch[1].trim();

          const dataMatch = line.match(/^data:\s*(.+)$/m);
          if (dataMatch) dataStr = dataMatch[1].trim();

          if (dataStr) {
            try {
              const parsedData = JSON.parse(dataStr);
              onEvent(eventName, parsedData);
            } catch (err) {
              onEvent(eventName, dataStr);
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("⚠️ SSE stream error:", err.message);
        onEvent("error", { error: "Network error during debate stream." });
      }
    }
  }

  fetchStream();

  return () => controller.abort();
}
