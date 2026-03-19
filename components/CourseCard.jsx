"use client";

import { useRouter } from "next/navigation";

export default function CourseCard({ course }) {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(`/dashboard/${course.id}`)}
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-card)",
        borderRadius: "var(--radius-lg)",
        padding: "24px",
        cursor: "pointer",
        transition: "border-color 0.15s ease",
      }}
      onMouseOver={(e) =>
        (e.currentTarget.style.borderColor = "var(--btn-normal)")
      }
      onMouseOut={(e) =>
        (e.currentTarget.style.borderColor = "var(--border-card)")
      }
    >
      <h3
        style={{
          fontFamily: "var(--font-display), 'Lora', serif",
          fontWeight: 500,
          fontSize: "18px",
          color: "var(--text-primary)",
        }}
      >
        {course.name}
      </h3>
      {course.framework_type && (
        <p
          style={{
            fontSize: "13px",
            color: "var(--text-muted)",
            marginTop: "8px",
          }}
        >
          {course.framework_type}
        </p>
      )}
    </div>
  );
}
