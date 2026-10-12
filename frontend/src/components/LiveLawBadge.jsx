/**
 * "Live" badge + Indian Kanoon link for citations fetched live from https://indiankanoon.org.
 */
export default function LiveLawBadge({ url }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginLeft: "6px", verticalAlign: "middle" }}>
      <span
        className="font-mono"
        title="Fetched live from Indian Kanoon"
        style={{
          fontSize: "0.65rem",
          padding: "1px 6px",
          borderRadius: "4px",
          backgroundColor: "rgba(59, 130, 246, 0.15)",
          color: "#60a5fa",
          border: "1px solid rgba(59, 130, 246, 0.45)",
          whiteSpace: "nowrap"
        }}
      >
        ● LIVE
      </span>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono"
          style={{ fontSize: "0.7rem", color: "#60a5fa", textDecoration: "underline", whiteSpace: "nowrap" }}
        >
          Indian Kanoon ↗
        </a>
      )}
    </span>
  );
}
