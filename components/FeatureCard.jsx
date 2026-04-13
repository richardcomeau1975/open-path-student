"use client";

import { useRouter, useParams } from "next/navigation";
import { useAdmin } from "../lib/admin";

const FEATURE_ROUTES = {
  visual_overview: "visual-overview",
  lectures: "lectures",
  walkthrough: "walkthrough",
  note_chart: "notechart",
  test_me: "test-me",
  how_tested: "how-tested",
};

export default function FeatureCard({ feature }) {
  const router = useRouter();
  const { courseId, topicId } = useParams();
  const { isAdmin } = useAdmin();
  const isAvailable = feature.state !== "not_available";

  const handleClick = () => {
    if (!isAvailable && !isAdmin) return;
    const route = FEATURE_ROUTES[feature.key];
    if (route) {
      router.push(`/dashboard/${courseId}/${topicId}/${route}`);
    }
  };

  const label = feature.name;

  return (
    <div
      onClick={handleClick}
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-card)",
        borderLeft: isAvailable
          ? "3px solid #4A7C59"
          : "3px solid #E8E4DA",
        borderRadius: "var(--radius-lg)",
        padding: "24px",
        opacity: (isAvailable || isAdmin) ? 1 : 0.55,
        cursor: (isAvailable || isAdmin) && FEATURE_ROUTES[feature.key] ? "pointer" : "default",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
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
            fontFamily: "var(--font-display), 'Lora', serif",
            fontWeight: 500,
            fontSize: "15px",
            color: "var(--text-primary)",
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
