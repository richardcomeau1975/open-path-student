"use client";

import { useRouter } from "next/navigation";

export default function BackButton({ href }) {
  const router = useRouter();

  return (
    <button
      onClick={() => (href ? router.push(href) : router.back())}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        background: "none",
        border: "none",
        color: "var(--text-muted)",
        fontSize: "14px",
        cursor: "pointer",
        padding: "0",
        marginBottom: "20px",
        fontFamily: "var(--font-body), 'Inter', sans-serif",
      }}
    >
      ← Back
    </button>
  );
}
