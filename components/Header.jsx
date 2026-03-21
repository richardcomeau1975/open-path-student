"use client";

import { useState, useEffect } from "react";
import { useUser, useAuth, UserButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../lib/api";

export default function Header() {
  const { user } = useUser();
  const { getToken, isLoaded } = useAuth();
  const pathname = usePathname();
  const [courseName, setCourseName] = useState("");

  const name = user?.firstName
    ? `${user.firstName} ${user.lastName || ""}`.trim()
    : "";

  // Extract courseId from path: /dashboard/{courseId}/...
  const parts = pathname.split("/").filter(Boolean);
  const courseId = parts.length >= 2 && parts[0] === "dashboard" ? parts[1] : null;
  // Don't treat "upload" or other non-UUID segments as courseId
  const isCourseId = courseId && courseId.length > 8;

  useEffect(() => {
    if (!isCourseId || !isLoaded) {
      setCourseName("");
      return;
    }
    async function fetchCourse() {
      try {
        const token = await getToken();
        const courses = await apiFetch("/api/courses", {}, token);
        const course = courses.find((c) => c.id === courseId);
        if (course) setCourseName(course.name);
      } catch {
        setCourseName("");
      }
    }
    fetchCourse();
  }, [courseId, isCourseId, isLoaded, getToken]);

  return (
    <header
      style={{
        backgroundColor: "var(--bg-card)",
        borderBottom: "1px solid var(--border-card)",
        padding: "16px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Link
          href="/dashboard"
          style={{
            fontFamily: "var(--font-display), 'Lora', serif",
            fontWeight: 600,
            fontSize: "16px",
            color: "var(--text-primary)",
            textDecoration: "none",
          }}
        >
          Open Path
        </Link>
        {name && (
          <>
            <span style={{ color: "var(--text-muted)" }}>/</span>
            <span
              style={{
                fontSize: "14px",
                color: "var(--text-muted)",
              }}
            >
              {name}
            </span>
          </>
        )}
        {courseName && (
          <>
            <span style={{ color: "var(--text-muted)" }}>/</span>
            <Link
              href={`/dashboard/${courseId}`}
              style={{
                fontSize: "14px",
                color: "var(--text-muted)",
                textDecoration: "none",
              }}
            >
              {courseName}
            </Link>
          </>
        )}
      </div>
      <UserButton afterSignOutUrl="/sign-in" />
    </header>
  );
}
