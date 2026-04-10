"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "../../lib/api";
import Link from "next/link";
import CourseCard from "../../components/CourseCard";

export default function CoursesPage() {
  const { getToken, isLoaded } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isLoaded) return;
    async function load() {
      try {
        const token = await getToken();
        const data = await apiFetch("/api/courses", {}, token);
        setCourses(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getToken, isLoaded]);

  if (loading) {
    return <p style={{ color: "var(--text-muted)" }}>Loading courses...</p>;
  }

  if (error) {
    return <p style={{ color: "var(--status-amber)" }}>Error: {error}</p>;
  }

  if (courses.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 24px" }}>
        <h2
          style={{
            fontFamily: "var(--font-display), 'Lora', serif",
            fontSize: "24px",
            fontWeight: 600,
            marginBottom: "12px",
          }}
        >
          No courses yet
        </h2>
        <p style={{ color: "var(--text-muted)" }}>
          Your instructor will add courses for you.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1
        style={{
          fontFamily: "var(--font-display), 'Lora', serif",
          fontSize: "28px",
          fontWeight: 600,
          marginBottom: "24px",
        }}
      >
        Your Courses
      </h1>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "20px",
        }}
      >
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>

      {/* Demos */}
      <div style={{ marginTop: 48, borderTop: '1px solid #222', paddingTop: 24 }}>
        <h2
          style={{
            fontFamily: "var(--font-display), 'Lora', serif",
            fontSize: "20px",
            fontWeight: 600,
            marginBottom: "16px",
            color: "var(--text-muted)",
          }}
        >
          Demos
        </h2>
        <Link
          href="/dashboard/travel/demo"
          style={{
            display: 'block',
            padding: '16px 20px',
            borderRadius: 12,
            background: '#111',
            border: '1px solid #2a2a2a',
            color: '#e5e5e5',
            textDecoration: 'none',
            maxWidth: 280,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600 }}>Travel Advisor</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Caribbean destination intelligence</div>
        </Link>
      </div>
    </div>
  );
}
