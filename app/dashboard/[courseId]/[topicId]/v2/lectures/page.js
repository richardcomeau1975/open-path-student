'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { apiFetch } from '../../../../../../lib/api';
import { useAdmin } from '../../../../../../lib/admin';
import Header from '../../../../../../components/Header';
import BackButton from '../../../../../../components/BackButton';
import AdminToolbar from '../../../../../../components/AdminToolbar';

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
      <div style={{ minHeight: '100vh', background: '#fdfbf7', color: '#1a1a1a' }}>
        <Header />
        <div style={{ position: 'fixed', top: 12, right: 16, background: '#8B6914', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, zIndex: 9999, letterSpacing: '0.5px' }}>v2</div>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
          <p style={{ color: '#9B8E82' }}>Loading lectures...</p>
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
    <div style={{ minHeight: '100vh', background: '#fdfbf7', color: '#1a1a1a' }}>
      <Header />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
        <BackButton href={`/dashboard/${courseId}/${topicId}/v2`} />

        <h1 style={{
          fontFamily: "var(--font-display), 'Lora', serif",
          fontSize: 24, fontWeight: 600, marginBottom: 4, marginTop: 16,
        }}>
          Lectures
        </h1>
        {segments && (
          <p style={{ color: '#9B8E82', fontSize: 14, marginBottom: 24 }}>
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
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#6B6B6B' }}>
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
                    background: '#ffffff',
                    border: '1px solid #E8E4DA',
                    borderRadius: 12,
                    padding: '20px 24px',
                  }}
                >
                  {/* Lecture link */}
                  <div
                    onClick={() => router.push(`/dashboard/${courseId}/${topicId}/v2/lectures/${seg.number}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{
                        fontSize: 20, color: seg.audio ? '#8B6914' : '#444',
                      }}>
                        ▶
                      </span>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>
                          Segment {seg.number}
                        </div>
                        <div style={{
                          fontSize: 13, color: '#6B6B6B', marginTop: 2,
                          maxWidth: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {title}
                        </div>
                        {duration && (
                          <div style={{ fontSize: 12, color: '#6B6B6B', marginTop: 2 }}>
                            {duration}
                          </div>
                        )}
                      </div>
                    </div>
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
