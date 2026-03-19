"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function Header() {
  const { user } = useUser();
  const pathname = usePathname();

  const name = user?.firstName
    ? `${user.firstName} ${user.lastName || ""}`.trim()
    : "";

  // Build breadcrumb from path
  const parts = pathname.split("/").filter(Boolean);
  // parts: ["dashboard"], ["dashboard", courseId], ["dashboard", courseId, "upload"], ["dashboard", courseId, topicId]

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
      </div>
      <UserButton afterSignOutUrl="/sign-in" />
    </header>
  );
}
