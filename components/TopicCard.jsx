"use client";

import { useRouter } from "next/navigation";

const STATUS_BADGE = {
  completed: { label: "Ready", bg: "#4A7C59", color: "#fff" },
  generating: { label: "Generating...", bg: "#C4972A", color: "#fff" },
  failed: { label: "Failed", bg: "#C44A2A", color: "#fff" },
};

export default function TopicCard({ topic, courseId }) {
  const router = useRouter();
  const badge = STATUS_BADGE[topic.generation_status];

  return (
    <div
      onClick={() => router.push(`/dashboard/${courseId}/${topic.id}`)}
      style={{
        backgroundColor: "var(--bg-card)",
        border: `1px solid ${
          topic.is_current ? "var(--accent-gold)" : "var(--border-card)"
        }`,
        borderRadius: "var(--radius-lg)",
        padding: "24px",
        cursor: "pointer",
        position: "relative",
        transition: "border-color 0.15s ease",
      }}
      onMouseOver={(e) => {
        if (!topic.is_current)
          e.currentTarget.style.borderColor = "var(--btn-normal)";
      }}
      onMouseOut={(e) => {
        if (!topic.is_current)
          e.currentTarget.style.borderColor = "var(--border-card)";
      }}
    >
      {topic.is_current && (
        <span
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            backgroundColor: "var(--accent-gold)",
            color: "#ffffff",
            fontSize: "11px",
            fontWeight: 500,
            padding: "3px 10px",
            borderRadius: "20px",
          }}
        >
          Current
        </span>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <h3
          style={{
            fontFamily: "var(--font-display), 'Lora', serif",
            fontWeight: 500,
            fontSize: "18px",
            color: "var(--text-primary)",
            paddingRight: topic.is_current ? "70px" : "0",
          }}
        >
          {topic.name}
        </h3>
        {badge && (
          <span
            style={{
              display: "inline-block",
              padding: "2px 10px",
              borderRadius: "12px",
              fontSize: "12px",
              fontWeight: 500,
              color: badge.color,
              background: badge.bg,
              whiteSpace: "nowrap",
            }}
          >
            {badge.label}
          </span>
        )}
      </div>
      {topic.week_number && (
        <p
          style={{
            fontSize: "13px",
            color: "var(--text-muted)",
            marginTop: "8px",
          }}
        >
          Week {topic.week_number}
        </p>
      )}
    </div>
  );
}
