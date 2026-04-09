"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "../../../../../lib/api";
import { useAdmin } from "../../../../../lib/admin";
import AdminToolbar from "../../../../../components/AdminToolbar";

export default function PodcastPage() {
  const { courseId, topicId } = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const { isAdmin } = useAdmin();

  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  // Q&A state
  const [qaMode, setQaMode] = useState(false);
  const [qaState, setQaState] = useState('idle'); // 'idle', 'recording', 'thinking', 'speaking'
  const [qaAnswer, setQaAnswer] = useState(null);
  const [qaTranscript, setQaTranscript] = useState(null);
  const [qaHistory, setQaHistory] = useState([]); // (#5) conversation history
  const [qaCount, setQaCount] = useState(0); // (#7) interruption counter
  const [fillerUrls, setFillerUrls] = useState([]); // (#3) filler audio URLs
  const [qaTextInput, setQaTextInput] = useState('');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fillerAudioRef = useRef(null); // currently playing filler

  const API = process.env.NEXT_PUBLIC_API_URL;
  const MAX_QUESTIONS = 5; // (#7) enforce limit

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const token = await getToken();
        const data = await apiFetch(`/api/topics/${topicId}/content`, {}, token);
        setContent(data);
      } catch (err) {
        console.error("Failed to fetch content:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, [topicId, getToken, refreshKey]);

  // (#3) Load filler audio URLs on mount
  useEffect(() => {
    async function loadFillers() {
      try {
        const token = await getToken();
        const res = await fetch(`${API}/api/voice/podcast/filler-urls`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setFillerUrls(data.fillers || []);
        }
      } catch (e) { /* silently fail — fillers are optional */ }
    }
    loadFillers();
  }, [getToken]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e) => {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    if (audioRef.current && duration) {
      audioRef.current.currentTime = ratio * duration;
    }
  };

  const handleEnded = () => {
    setPlaying(false);
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Q&A functions
  async function startQaRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await sendQaQuestion(audioBlob);
      };

      mediaRecorder.start();
      setQaState('recording');
    } catch (err) {
      console.error('Mic access denied:', err);
    }
  }

  function stopQaRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }

  // (#3/#4) Play a random filler clip
  function playRandomFiller() {
    if (fillerUrls.length === 0) return Promise.resolve();
    const filler = fillerUrls[Math.floor(Math.random() * fillerUrls.length)];
    return new Promise((resolve) => {
      const audio = new Audio(filler.url);
      fillerAudioRef.current = audio;
      audio.onended = () => { fillerAudioRef.current = null; resolve(); };
      audio.onerror = () => { fillerAudioRef.current = null; resolve(); };
      audio.play().catch(() => resolve());
    });
  }

  async function sendQaQuestion(audioBlob) {
    setQaState('speaking'); // (#4) show speaking immediately — filler is playing

    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      // (#4) Start filler immediately AND API call in parallel
      const fillerPromise = playRandomFiller();

      const token = await getToken();
      const apiPromise = fetch(`${API}/api/voice/podcast/${topicId}/ask`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio: base64Audio,
          pausedAt: currentTime, // (#1)
          history: qaHistory, // (#5)
        }),
      }).then(r => r.json());

      // Wait for BOTH filler to finish AND API to respond
      const [, data] = await Promise.all([fillerPromise, apiPromise]);

      // Tiny pause after filler before real response
      await new Promise(r => setTimeout(r, 200));

      setQaTranscript(data.transcript);
      setQaAnswer(data.answer);

      // (#5) Append to conversation history
      if (data.transcript && data.answer) {
        setQaHistory(prev => [...prev,
          { role: 'user', content: data.transcript },
          { role: 'assistant', content: data.answer },
        ]);
        setQaCount(c => c + 1); // (#7)
      }

      if (data.audio) {
        await playAudioBase64(data.audio);
      }
    } catch (err) {
      console.error('Q&A failed:', err);
    }

    setQaState('idle');
  }

  async function sendQaTextQuestion(question) {
    setQaState('thinking');
    setQaTextInput('');

    try {
      const fillerPromise = playRandomFiller();

      const token = await getToken();
      const apiPromise = fetch(`${API}/api/voice/podcast/${topicId}/ask`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: question,
          pausedAt: currentTime,
          history: qaHistory,
        }),
      }).then(r => r.json());

      const [, data] = await Promise.all([fillerPromise, apiPromise]);
      await new Promise(r => setTimeout(r, 200));

      setQaTranscript(question);
      setQaAnswer(data.answer);
      setQaState('speaking');

      if (question && data.answer) {
        setQaHistory(prev => [...prev,
          { role: 'user', content: question },
          { role: 'assistant', content: data.answer },
        ]);
        setQaCount(c => c + 1);
      }

      if (data.audio) {
        await playAudioBase64(data.audio);
      }
    } catch (err) {
      console.error('Q&A failed:', err);
    }

    setQaState('idle');
  }

  async function playAudioBase64(base64PCM) {
    return new Promise((resolve) => {
      const binaryString = atob(base64PCM);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const sampleRate = 24000;
      const dataSize = bytes.length;
      const header = new ArrayBuffer(44);
      const view = new DataView(header);

      function ws(v, o, s) { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
      ws(view, 0, 'RIFF');
      view.setUint32(4, 36 + dataSize, true);
      ws(view, 8, 'WAVE');
      ws(view, 12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      ws(view, 36, 'data');
      view.setUint32(40, dataSize, true);

      const wav = new Uint8Array(44 + dataSize);
      wav.set(new Uint8Array(header), 0);
      wav.set(bytes, 44);

      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      audio.play();
    });
  }

  if (loading) {
    return (
      <div style={{ padding: "40px", fontFamily: "Inter, sans-serif", color: "#6B6B6B" }}>
        Loading podcast...
      </div>
    );
  }

  if (!content?.podcast_audio) {
    return (
      <div style={{ padding: "24px 32px", maxWidth: "800px", margin: "0 auto" }}>
        <button onClick={() => router.back()} style={backBtnStyle}>
          &larr; Back
        </button>
        {isAdmin && (
          <>
            <AdminToolbar topicId={topicId} outputType="podcast_script" label="Podcast Script"
              showTestPrompt={true} downstreamLabel="Generate audio ↓" accept=".txt,.md,.yaml,.yml"
              onRefresh={() => setRefreshKey(k => k + 1)} />
            <AdminToolbar topicId={topicId} outputType="podcast_audio" label="Podcast Audio"
              showTestPrompt={false} downstreamLabel={null} accept=".mp3,.wav"
              onRefresh={() => setRefreshKey(k => k + 1)} />
          </>
        )}
        <p style={{ fontFamily: "Inter, sans-serif", color: "#6B6B6B", marginTop: "20px" }}>
          No podcast available yet.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: "800px", margin: "0 auto" }}>
      <button onClick={() => router.back()} style={backBtnStyle}>
        &larr; Back
      </button>

      {isAdmin && (
        <>
          <AdminToolbar topicId={topicId} outputType="podcast_script" label="Podcast Script"
            showTestPrompt={true} downstreamLabel="Generate audio ↓" accept=".txt,.md,.yaml,.yml"
            onRefresh={() => setRefreshKey(k => k + 1)} />
          <AdminToolbar topicId={topicId} outputType="podcast_audio" label="Podcast Audio"
            showTestPrompt={false} downstreamLabel={null} accept=".mp3,.wav"
            onRefresh={() => setRefreshKey(k => k + 1)} />
          {fillerUrls.length === 0 && (
            <div style={{ background: "#f5f0e8", border: "1px solid #E8E4DA", borderRadius: 10, padding: "8px 14px", marginBottom: 10 }}>
              <button
                onClick={async () => {
                  try {
                    const token = await getToken();
                    const res = await fetch(`${API}/api/voice/podcast/generate-fillers`, {
                      method: "POST",
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    const data = await res.json();
                    alert(`Generated ${data.generated}/16 filler clips`);
                    // Reload fillers
                    const r2 = await fetch(`${API}/api/voice/podcast/filler-urls`, {
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    if (r2.ok) { const d = await r2.json(); setFillerUrls(d.fillers || []); }
                  } catch (e) { alert("Failed: " + e.message); }
                }}
                style={{ background: "#9B8E82", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
              >
                Generate Filler Clips (one-time)
              </button>
              <span style={{ fontSize: 11, color: "#6B6B6B", marginLeft: 8 }}>No filler clips found — generate them once</span>
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: "16px", marginBottom: "24px" }}>
        <div
          style={{
            fontSize: "13px",
            color: "#8B6914",
            fontFamily: "Inter, sans-serif",
            fontWeight: 500,
            letterSpacing: "0.5px",
          }}
        >
          PODCAST
        </div>
        <h1
          style={{
            fontFamily: "Lora, serif",
            fontWeight: 600,
            fontSize: "28px",
            marginTop: "4px",
          }}
        >
          {content.name || "Podcast"}
        </h1>
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={content.podcast_audio}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {/* Player card */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #E8E4DA",
          borderRadius: "12px",
          padding: "32px",
        }}
      >
        {/* Play button + time */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <button
            onClick={handlePlayPause}
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "#9B8E82",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: "22px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {playing ? "\u275A\u275A" : "\u25B6"}
          </button>

          <div style={{ flex: 1 }}>
            {/* Progress bar (clickable) */}
            <div
              onClick={handleSeek}
              style={{
                height: "8px",
                background: "#E8E4DA",
                borderRadius: "4px",
                cursor: "pointer",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                  background: "#8B6914",
                  borderRadius: "4px",
                  transition: "width 0.1s linear",
                }}
              />
            </div>

            {/* Time display */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "6px",
                fontSize: "13px",
                color: "#6B6B6B",
                fontFamily: "Inter, sans-serif",
              }}
            >
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        {/* Pause & Ask button — (#7) enforces 5 question limit */}
        <div style={{ marginTop: "28px", textAlign: "center" }}>
          {qaCount >= MAX_QUESTIONS ? (
            <p style={{ fontSize: 13, color: "#6B6B6B", fontFamily: "Inter, sans-serif" }}>
              You&apos;ve used your {MAX_QUESTIONS} questions for this podcast — resume and finish listening, then use the walkthrough to dig deeper.
            </p>
          ) : (
            <button
              onClick={() => {
                if (audioRef.current && playing) {
                  audioRef.current.pause();
                  setPlaying(false);
                }
                setQaMode(true);
                setQaState('idle');
                setQaAnswer(null);
                setQaTranscript(null);
              }}
              style={{
                padding: "12px 28px",
                background: "#F5F3EE",
                border: "1px solid #E8E4DA",
                borderRadius: "8px",
                color: "#6B6B6B",
                fontFamily: "Inter, sans-serif",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Pause & Ask a Question ({MAX_QUESTIONS - qaCount} remaining)
            </button>
          )}
        </div>
      </div>

      {/* Q&A interaction */}
      {qaMode && (
        <div style={{
          background: '#fff',
          border: '1px solid #E8E4DA',
          borderRadius: 12,
          padding: '1.5rem',
          marginTop: '1rem',
        }}>
          {/* Recording / states */}
          {qaState === 'idle' && !qaAnswer && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, marginBottom: 12 }}>What&apos;s your question?</div>
              <div style={{ display: 'flex', gap: 8, maxWidth: 500, margin: '0 auto' }}>
                <input
                  type="text"
                  placeholder="Type your question..."
                  value={qaTextInput || ''}
                  onChange={(e) => setQaTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && qaTextInput?.trim()) {
                      sendQaTextQuestion(qaTextInput.trim());
                    }
                  }}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: 8,
                    border: '1px solid #E8E4DA', fontFamily: 'Inter, sans-serif',
                    fontSize: 14, outline: 'none',
                  }}
                />
                <button
                  onClick={() => {
                    if (qaTextInput?.trim()) sendQaTextQuestion(qaTextInput.trim());
                  }}
                  style={{
                    padding: '10px 20px', background: '#9B8E82', color: '#fff',
                    border: 'none', borderRadius: 8, cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif', fontSize: 14,
                  }}
                >
                  Ask
                </button>
              </div>
              <div style={{ fontSize: 12, color: '#6B6B6B', marginTop: 12 }}>
                or <button onClick={startQaRecording} style={{ background: 'none', border: 'none', color: '#8B6914', cursor: 'pointer', textDecoration: 'underline', fontSize: 12 }}>use your microphone</button>
              </div>
            </div>
          )}

          {qaState === 'recording' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, marginBottom: 12 }}>Listening...</div>
              <button
                onClick={stopQaRecording}
                style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: '#3A3528', border: 'none', cursor: 'pointer',
                  color: '#fff', fontSize: 20,
                }}
              >
                {'\u23F9'}
              </button>
            </div>
          )}

          {qaState === 'thinking' && (
            <div style={{ textAlign: 'center' }}>
              {qaTranscript && (
                <div style={{ fontSize: 13, color: '#6B6B6B', marginBottom: 8, fontStyle: 'italic' }}>
                  &ldquo;{qaTranscript}&rdquo;
                </div>
              )}
              <div style={{ fontSize: 14, color: '#8B6914' }}>Thinking...</div>
            </div>
          )}

          {qaState === 'speaking' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: '#8B6914', marginBottom: 8 }}>Speaking...</div>
              {qaAnswer && (
                <div style={{ fontSize: 14, textAlign: 'left', lineHeight: 1.6, marginTop: 12 }}>
                  {qaAnswer}
                </div>
              )}
            </div>
          )}

          {/* Answer displayed + resume button */}
          {qaAnswer && qaState === 'idle' && (
            <div>
              {qaTranscript && (
                <div style={{ fontSize: 13, color: '#6B6B6B', marginBottom: 8, fontStyle: 'italic' }}>
                  You asked: &ldquo;{qaTranscript}&rdquo;
                </div>
              )}
              <div style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
                {qaAnswer}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    setQaMode(false);
                    setQaHistory([]); // (#5) reset history on resume
                    if (audioRef.current) audioRef.current.play();
                    setPlaying(true);
                  }}
                  style={{
                    background: '#9B8E82', color: '#fff', border: 'none',
                    borderRadius: 8, padding: '10px 20px', fontSize: 14,
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 500,
                  }}
                >
                  Resume Podcast
                </button>
                <button
                  onClick={() => { setQaAnswer(null); setQaTranscript(null); }}
                  style={{
                    background: 'transparent', border: '1px solid #E8E4DA',
                    borderRadius: 8, padding: '10px 20px', fontSize: 14,
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Ask another question
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const backBtnStyle = {
  background: "none",
  border: "none",
  color: "#6B6B6B",
  fontFamily: "Inter, sans-serif",
  fontSize: "15px",
  cursor: "pointer",
  padding: "4px 0",
};
