'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useAdmin } from '../../../../../lib/admin';
import AdminToolbar from '../../../../../components/AdminToolbar';

export default function WalkthroughPage() {
  const { courseId, topicId } = useParams();
  const { getToken } = useAuth();
  const { isAdmin } = useAdmin();

  // View state
  const [view, setView] = useState('choices'); // 'choices' or 'active'
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Conversation state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Voice state
  const [voiceMode, setVoiceMode] = useState(false);
  const [recording, setRecording] = useState(false);
  const [micState, setMicState] = useState('idle'); // 'idle', 'recording', 'thinking', 'speaking'
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const API = process.env.NEXT_PUBLIC_API_URL;

  // Load existing sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/walkthrough/${topicId}/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
    setLoading(false);
  }

  async function startSession(mode, cluster = null, sessionId = null) {
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/walkthrough/${topicId}/start`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode,
          cluster,
          session_id: sessionId,
        }),
      });
      const data = await res.json();
      setCurrentSession(data.session);
      setMessages(data.session.messages || []);
      setView('active');

      // If resuming and there are messages, don't send opening prompt
      // If new session, send an opening prompt automatically
      if (!sessionId && (!data.session.messages || data.session.messages.length === 0)) {
        // Send initial message to get the AI to start
        sendMessage('Begin', data.session.id);
      }
    } catch (err) {
      console.error('Failed to start session:', err);
    }
  }

  async function sendMessage(text = null, sessionId = null) {
    const messageText = text || input.trim();
    if (!messageText || streaming) return;

    const sid = sessionId || currentSession?.id;
    if (!sid) return;

    // Add user message to display (unless it's the hidden "Begin" prompt)
    if (text !== 'Begin') {
      setMessages(prev => [...prev, { role: 'user', content: messageText }]);
    }
    setInput('');
    setStreaming(true);
    setStreamingText('');

    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/walkthrough/${topicId}/message`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sid,
          message: messageText,
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'text') {
                fullText += data.text;
                setStreamingText(fullText);
              } else if (data.type === 'done') {
                setMessages(prev => [...prev, { role: 'assistant', content: fullText }]);
                setStreamingText('');
              } else if (data.type === 'error') {
                console.error('Stream error:', data.error);
              }
            } catch (e) {
              // skip malformed JSON
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }

    setStreaming(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Voice recording functions
  async function startRecording() {
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
        await sendVoiceMessage(audioBlob);
      };

      mediaRecorder.start();
      setRecording(true);
      setMicState('recording');
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }

  async function sendVoiceMessage(audioBlob) {
    setMicState('thinking');

    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      const token = await getToken();
      const res = await fetch(`${API}/api/voice/walkthrough/${topicId}/voice-message`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: currentSession?.id,
          audio: base64Audio,
        }),
      });

      const data = await res.json();

      if (data.transcript) {
        setMessages(prev => [...prev, { role: 'user', content: data.transcript }]);
      }

      if (data.text) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);
      }

      if (data.audio) {
        setMicState('speaking');
        await playAudioBase64(data.audio);
      }
    } catch (err) {
      console.error('Voice message failed:', err);
    }

    setMicState('idle');
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

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // Focus input when active view loads
  useEffect(() => {
    if (view === 'active' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [view, streaming]);

  // Find most recent active session for "Continue" button
  const activeSession = sessions.find(s => s.is_active && s.message_count > 0);

  // --- RENDER ---

  if (loading) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'var(--font-body)' }}>
        Loading...
      </div>
    );
  }

  // CHOICES VIEW
  if (view === 'choices') {
    return (
      <div style={{ padding: '2rem', maxWidth: 700, margin: '0 auto' }}>
        <div
          onClick={() => window.history.back()}
          style={{ fontSize: 13, color: '#6B6B6B', cursor: 'pointer', marginBottom: '1rem' }}
        >
          &larr; Back
        </div>

        {isAdmin && (
          <AdminToolbar topicId={topicId} outputType="learning_asset" label="Learning Asset"
            showTestPrompt={true} downstreamLabel={null} accept=".txt,.md"
            onRefresh={() => {}} />
        )}

        <div style={{
          fontSize: 13,
          color: '#8B6914',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 4,
          fontFamily: 'var(--font-body)',
        }}>
          Knowledge Walkthrough
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 24,
          fontWeight: 600,
          marginBottom: '2rem',
        }}>
          What would you like to work on?
        </h1>

        {/* Continue from previous session */}
        {activeSession && (
          <div
            onClick={() => startSession(activeSession.mode, activeSession.cluster, activeSession.id)}
            style={{
              background: '#fff',
              border: '1px solid #E8E4DA',
              borderLeft: '3px solid #8B6914',
              borderRadius: 12,
              padding: '1.25rem',
              marginBottom: '1rem',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontWeight: 500, fontSize: 15 }}>
              Continue where you left off
            </div>
            <div style={{ fontSize: 13, color: '#6B6B6B', marginTop: 4 }}>
              {activeSession.last_message_preview}...
            </div>
          </div>
        )}

        {/* Foundation mode */}
        <div
          onClick={() => startSession('foundation')}
          style={{
            background: '#fff',
            border: '1px solid #E8E4DA',
            borderRadius: 12,
            padding: '1.25rem',
            marginBottom: '0.75rem',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontWeight: 500, fontSize: 15 }}>
            Build the foundation
          </div>
          <div style={{ fontSize: 13, color: '#6B6B6B', marginTop: 4 }}>
            Start with the basics and work up
          </div>
        </div>

        {/* Application mode */}
        <div
          onClick={() => startSession('application')}
          style={{
            background: '#fff',
            border: '1px solid #E8E4DA',
            borderRadius: 12,
            padding: '1.25rem',
            marginBottom: '0.75rem',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontWeight: 500, fontSize: 15 }}>
            I&apos;m ready to apply it
          </div>
          <div style={{ fontSize: 13, color: '#6B6B6B', marginTop: 4 }}>
            Jump into scenarios and application
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE CONVERSATION VIEW
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      maxWidth: 700,
      margin: '0 auto',
      fontFamily: 'var(--font-body)',
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 2rem',
        borderBottom: '1px solid #E8E4DA',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <div style={{
            fontSize: 13,
            color: '#8B6914',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Knowledge Walkthrough
          </div>
          <div style={{ fontSize: 14, color: '#6B6B6B' }}>
            {currentSession?.mode === 'foundation' ? 'Building the foundation' : 'Application mode'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div
            onClick={() => setVoiceMode(!voiceMode)}
            style={{
              fontSize: 13,
              color: voiceMode ? '#8B6914' : '#6B6B6B',
              cursor: 'pointer',
              padding: '6px 12px',
              border: `1px solid ${voiceMode ? '#8B6914' : '#E8E4DA'}`,
              borderRadius: 8,
              background: voiceMode ? '#faf7f0' : 'transparent',
            }}
          >
            {voiceMode ? 'Voice on' : 'Voice off'}
          </div>
          <div
            onClick={() => setView('choices')}
            style={{
              fontSize: 13, color: '#6B6B6B', cursor: 'pointer',
              padding: '6px 12px', border: '1px solid #E8E4DA', borderRadius: 8,
            }}
          >
            Change focus
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1.5rem 2rem',
      }}>
        {messages.filter(m => !(m.role === 'user' && m.content === 'Begin')).map((msg, i) => (
          <div
            key={i}
            style={{
              marginBottom: '1.25rem',
              maxWidth: msg.role === 'user' ? '80%' : '100%',
              marginLeft: msg.role === 'user' ? 'auto' : 0,
            }}
          >
            {msg.role === 'assistant' && (
              <div style={{
                fontSize: 11,
                color: '#8B6914',
                marginBottom: 4,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Open Path
              </div>
            )}
            <div style={{
              background: msg.role === 'user' ? '#f5f3ee' : '#fff',
              border: msg.role === 'user' ? 'none' : '1px solid #E8E4DA',
              borderRadius: 12,
              padding: '0.875rem 1rem',
              fontSize: 15,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {/* Streaming text */}
        {streamingText && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{
              fontSize: 11,
              color: '#8B6914',
              marginBottom: 4,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Open Path
            </div>
            <div style={{
              background: '#fff',
              border: '1px solid #E8E4DA',
              borderRadius: 12,
              padding: '0.875rem 1rem',
              fontSize: 15,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}>
              {streamingText}
            </div>
          </div>
        )}

        {/* Thinking indicator */}
        {streaming && !streamingText && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{
              fontSize: 11,
              color: '#8B6914',
              marginBottom: 4,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Open Path
            </div>
            <div style={{
              background: '#fff',
              border: '1px solid #E8E4DA',
              borderRadius: 12,
              padding: '0.875rem 1rem',
              fontSize: 15,
              color: '#6B6B6B',
            }}>
              Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={{
        padding: '1rem 2rem',
        borderTop: '1px solid #E8E4DA',
        background: '#fdfbf7',
      }}>
        {voiceMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.5rem 0', position: 'relative' }}>
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={micState === 'thinking' || micState === 'speaking'}
              style={{
                width: 64, height: 64, borderRadius: '50%', border: 'none',
                cursor: micState === 'thinking' || micState === 'speaking' ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                background: micState === 'recording' ? '#3A3528' :
                            micState === 'thinking' || micState === 'speaking' ? '#E8E4DA' : '#9B8E82',
                color: '#fff', transition: 'all 0.2s',
              }}
            >
              {micState === 'idle' && '\uD83C\uDFA4'}
              {micState === 'recording' && '\u23F9'}
              {micState === 'thinking' && '...'}
              {micState === 'speaking' && '\uD83D\uDD0A'}
            </button>
            <div style={{ fontSize: 12, color: '#6B6B6B', textAlign: 'center', marginTop: 8 }}>
              {micState === 'idle' && 'Tap to speak'}
              {micState === 'recording' && 'Listening...'}
              {micState === 'thinking' && 'Thinking...'}
              {micState === 'speaking' && 'Speaking...'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your response..."
              disabled={streaming}
              rows={1}
              style={{
                flex: 1, padding: '10px 14px', border: '1px solid #E8E4DA', borderRadius: 8,
                fontSize: 15, fontFamily: 'var(--font-body)', resize: 'none', outline: 'none',
                lineHeight: 1.5, minHeight: 42, maxHeight: 120, overflow: 'auto', background: '#fff',
              }}
              onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={streaming || !input.trim()}
              style={{
                background: streaming || !input.trim() ? '#E8E4DA' : '#9B8E82',
                color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px',
                fontSize: 14, fontFamily: 'var(--font-body)',
                cursor: streaming || !input.trim() ? 'default' : 'pointer',
                fontWeight: 500, whiteSpace: 'nowrap',
              }}
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
