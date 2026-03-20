"use client";

import { useRouter, useParams } from "next/navigation";

const FEATURE_ROUTES = {
  visual_overview: "visual-overview",
  podcast: "podcast",
};

export default function FeatureCard({ feature }) {
  const router = useRouter();
  const { courseId, topicId } = useParams();
  const isAvailable = feature.state !== "not_available";

  const handleClick = () => {
    if (!isAvailable) return;
    const route = FEATURE_ROUTES[feature.key];
    if (route) {
      router.push(`/dashboard/${courseId}/${topicId}/${route}`);
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-card)",
        borderLeft: isAvailable
          ? "3px solid #4A7C59"
          : "1px solid var(--border-card)",
        borderRadius: "var(--radius-lg)",
        padding: "24px",
        opacity: isAvailable ? 1 : 0.55,
        cursor: isAvailable && FEATURE_ROUTES[feature.key] ? "pointer" : "default",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "28px",
            height: "28px",
            borderRadius: "50%",
            backgroundColor: isAvailable
              ? "var(--accent-gold)"
              : "var(--border-card)",
            color: isAvailable ? "#ffffff" : "var(--text-muted)",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          {feature.number}
        </span>
        <span
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {feature.name}
        </span>
      </div>
      <h3
        style={{
          fontFamily: "var(--font-display), 'Lora', serif",
          fontWeight: 500,
          fontSize: "17px",
          color: "var(--text-primary)",
          marginBottom: "6px",
        }}
      >
        {feature.description}
      </h3>
      <p
        style={{
          fontSize: "13px",
          color: isAvailable ? "#4A7C59" : "var(--text-muted)",
          fontStyle: isAvailable ? "normal" : "italic",
          fontWeight: isAvailable ? 500 : 400,
        }}
      >
        {isAvailable ? "Ready" : "Not yet available"}
      </p>
    </div>
  );
}
