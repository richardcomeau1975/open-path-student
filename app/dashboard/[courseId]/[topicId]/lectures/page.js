'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { apiFetch } from '../../../../../lib/api';
import { useAdmin } from '../../../../../lib/admin';
import Header from '../../../../../components/Header';
import BackButton from '../../../../../components/BackButton';
import AdminToolbar from '../../../../../components/AdminToolbar';

export default function LecturesPage() {
  const { courseId, topicId } = useParams();
  const router = useRouter();
  const { getToken, isLoaded } = useAuth();
  const { isAdmin } = useAdmin();
  const [segments, setSegments] = useState(null);
  const [topicName, setTopicName] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!isLoaded) return;
    async function load() {
      try {
        const token = await getToken();
        const content = await apiFetch(`/api/topics/${topicId}/content`, {}, token);
        setTopicName(content.name || '');
        setSegments(content.lecture_segments || null);
      } catch (err) {
        console.error('Failed to load lectures:', err);
      }
      setLoading(false);
    }
    load();
  }, [topicId, getToken, isLoaded, refreshKey]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e5e5' }}>
        <Header />
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
          <p style={{ color: '#888' }}>Loading lectures...</p>
        </div>
      </div>
    );
  }

  // Format duration from seconds
  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const mins = Math.round(seconds / 60);
    return `~${mins} min`;
  };

  // Calculate total duration
  const totalDuration = segments
    ? segments.reduce((sum, seg) => sum + (seg.timestamps?.duration || 0), 0)
    : 0;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e5e5' }}>
      <Header />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
        <BackButton href={`/dashboard/${courseId}/${topicId}`} />

        <h1 style={{
          fontFamily: "var(--font-display), 'Lora', serif",
          fontSize: 24, fontWeight: 600, marginBottom: 4, marginTop: 16,
        }}>
          Lectures
        </h1>
        {segments && (
          <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>
            {segments.length} segment{segments.length !== 1 ? 's' : ''}
            {totalDuration > 0 ? ` · ${formatDuration(totalDuration)} total` : ''}
          </p>
        )}

        {isAdmin && (
          <div style={{ marginBottom: 24 }}>
            <AdminToolbar
              topicId={topicId}
              outputType="podcast_script"
              label="Lecture Script"
              showTestPrompt={true}
              downstreamLabel="Regenerate script + segments + audio + images ↓"
              accept=".txt,.md"
              onRefresh={() => setRefreshKey(k => k + 1)}
            />
            <AdminToolbar
              topicId={topicId}
              outputType="podcast_audio"
              label="Lecture Audio (all segments)"
              accept=".wav,.mp3"
              onRefresh={() => setRefreshKey(k => k + 1)}
            />
          </div>
        )}

        {!segments ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#666' }}>
            <p>No lecture segments generated yet.</p>
            <p style={{ fontSize: 13, marginTop: 8 }}>Generate a lecture script from the admin toolbar to create segments.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {segments.map((seg) => {
              const title = seg.anchors?.[0] || `Segment ${seg.number}`;
              const duration = formatDuration(seg.timestamps?.duration);

              return (
                <div
                  key={seg.number}
                  style={{
                    background: '#111',
                    border: '1px solid #222',
                    borderRadius: 12,
                    padding: '20px 24px',
                  }}
                >
                  {/* Lecture link */}
                  <div
                    onClick={() => router.push(`/dashboard/${courseId}/${topicId}/lectures/${seg.number}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{
                        fontSize: 20, color: seg.audio ? '#2563eb' : '#444',
                      }}>
                        ▶
                      </span>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#e5e5e5' }}>
                          Lecture {seg.number}
                        </div>
                        <div style={{
                          fontSize: 13, color: '#aaa', marginTop: 2,
                          maxWidth: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {title}
                        </div>
                        {duration && (
                          <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                            {duration}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tutorial link */}
                  <div
                    onClick={() => router.push(`/dashboard/${courseId}/${topicId}/lectures/${seg.number}/tutorial`)}
                    style={{
                      marginTop: 12, paddingTop: 12, borderTop: '1px solid #1a1a1a',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 14, color: '#555' }}>○</span>
                    <span style={{ fontSize: 13, color: '#888' }}>Tutorial</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
