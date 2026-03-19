"use client";

import { useRouter } from "next/navigation";

export default function TopicCard({ topic, courseId }) {
  const router = useRouter();

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
