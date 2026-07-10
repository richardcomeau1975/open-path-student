'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { apiFetch } from '../../../lib/api';
import Header from '../../../components/Header';
import BackButton from '../../../components/BackButton';

const API = process.env.NEXT_PUBLIC_API_URL;

const STATUS_SENTENCE = {
  none: 'Uploaded — press Build to create the learning materials.',
  idle: 'Ready to build.',
  pending: 'Queued…',
  generating: 'Building your materials — this takes a few minutes…',
  completed: 'Ready.',
  failed: 'Something went wrong during the build.',
};

export default function V3Course() {
  const { courseId } = useParams();
  const router = useRouter();
  const { getToken, isLoaded } = useAuth();
  const [topics, setTopics] = useState(null);
  const [courseName, setCourseName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const pollRef = useRef(null);

  async function load() {
    try {
      const token = await getToken();
      const data = await apiFetch(`/api/courses/${courseId}/topics`, {}, token);
      setTopics(data.topics || data || []);
      if (data.course?.name) setCourseName(data.course.name);
    } catch (e) {
      console.error('Failed to load topics:', e);
      setTopics([]);
    }
  }

  useEffect(() => {
    if (!isLoaded) return;
    load();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isLoaded, courseId]);

  // Poll while anything is generating
  useEffect(() => {
    const anyGenerating = (topics || []).some(t => t.generation_status === 'generating' || t.generation_status === 'pending');
    if (anyGenerating && !pollRef.current) {
      pollRef.current = setInterval(load, 8000);
    }
    if (!anyGenerating && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [topics]);

  async function handleUpload(files) {
    if (!files.length || !newName.trim()) {
      setError('Give the topic a name first (e.g. "Week 1"), then choose the file.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const token = await getToken();
      const form = new FormData();
      form.append('course_id', courseId);
      form.append('name', newName.trim());
      for (const f of files) form.append('files', f);
      const res = await fetch(`${API}/api/topics`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      setNewName('');
      await load();
    } catch (e) {
      setError(`Upload failed: ${e.message}`);
    }
    setUploading(false);
  }

  async function handleBuild(topicId) {
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/topics/${topicId}/generate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      setError(`Build failed to start: ${e.message}`);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fdfbf7', color: '#1a1a1a' }}>
      <Header />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px' }}>
        <BackButton href="/v3" />
        <h1 style={{ fontFamily: "var(--font-display), 'Lora', serif", fontSize: 26, fontWeight: 600, margin: '16px 0 24px' }}>
          {courseName || 'Course'}
        </h1>

        {/* Upload */}
        <div style={{ background: '#fff', border: '1px solid #E8E4DA', borderRadius: 12, padding: 20, marginBottom: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Add new material</div>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Topic name (e.g. Week 2 — Console Wars)"
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E8E4DA',
              fontSize: 14, marginBottom: 10, boxSizing: 'border-box', background: '#fdfbf7',
            }}
          />
          <label style={{
            display: 'inline-block', padding: '10px 20px', borderRadius: 8,
            background: uploading ? '#E8E4DA' : '#8B6914', color: uploading ? '#9B8E82' : '#fff',
            cursor: uploading ? 'default' : 'pointer', fontSize: 14, fontWeight: 500,
          }}>
            {uploading ? 'Uploading…' : 'Choose file & upload'}
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.docx,.pptx,.txt,.md"
              disabled={uploading}
              onChange={(e) => {
                const files = Array.from(e.target.files);
                if (files.length) handleUpload(files);
                e.target.value = '';
              }}
              style={{ display: 'none' }}
            />
          </label>
          {error && <div style={{ color: '#c0392b', fontSize: 13, marginTop: 10 }}>{error}</div>}
        </div>

        {/* Topics */}
        {!topics ? (
          <p style={{ color: '#9B8E82' }}>Loading…</p>
        ) : topics.length === 0 ? (
          <p style={{ color: '#6B6B6B' }}>Nothing here yet — upload your first material above.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {topics.map((t) => {
              const status = t.generation_status || 'none';
              const sentence = STATUS_SENTENCE[status] || status;
              const ready = status === 'completed';
              const canBuild = status === 'none' || status === 'idle' || status === 'failed';
              return (
                <div
                  key={t.id}
                  style={{
                    background: '#fff', border: '1px solid #E8E4DA', borderRadius: 12,
                    padding: '18px 22px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  }}
                >
                  <div
                    onClick={() => ready && router.push(`/v3/${courseId}/${t.id}`)}
                    style={{ cursor: ready ? 'pointer' : 'default', flex: 1 }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{t.name}</div>
                    <div style={{
                      fontSize: 13, marginTop: 4,
                      color: status === 'failed' ? '#c0392b' : status === 'generating' ? '#8B6914' : '#6B6B6B',
                    }}>
                      {sentence}
                    </div>
                  </div>
                  {canBuild && (
                    <button
                      onClick={() => handleBuild(t.id)}
                      style={{
                        padding: '10px 20px', borderRadius: 8, border: 'none',
                        background: '#4A7C59', color: '#fff', cursor: 'pointer',
                        fontSize: 14, fontWeight: 500, flexShrink: 0,
                      }}
                    >
                      {status === 'failed' ? 'Rebuild' : 'Build'}
                    </button>
                  )}
                  {ready && (
                    <span style={{ color: '#8B6914', fontSize: 20, flexShrink: 0 }}>→</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
