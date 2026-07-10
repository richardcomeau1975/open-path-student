'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { apiFetch } from '../../lib/api';
import Header from '../../components/Header';

export default function V3Home() {
  const router = useRouter();
  const { getToken, isLoaded } = useAuth();
  const [courses, setCourses] = useState(null);

  useEffect(() => {
    if (!isLoaded) return;
    (async () => {
      try {
        const token = await getToken();
        const data = await apiFetch('/api/courses', {}, token);
        setCourses(data.courses || data || []);
      } catch (e) {
        console.error('Failed to load courses:', e);
        setCourses([]);
      }
    })();
  }, [isLoaded]);

  return (
    <div style={{ minHeight: '100vh', background: '#fdfbf7', color: '#1a1a1a' }}>
      <Header />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontFamily: "var(--font-display), 'Lora', serif", fontSize: 26, fontWeight: 600, marginBottom: 24 }}>
          Your courses
        </h1>
        {!courses ? (
          <p style={{ color: '#9B8E82' }}>Loading…</p>
        ) : courses.length === 0 ? (
          <p style={{ color: '#6B6B6B' }}>No courses yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {courses.map((c) => (
              <div
                key={c.id}
                onClick={() => router.push(`/v3/${c.id}`)}
                style={{
                  background: '#fff', border: '1px solid #E8E4DA', borderRadius: 12,
                  padding: '18px 22px', cursor: 'pointer', fontSize: 16, fontWeight: 500,
                }}
              >
                {c.name}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
