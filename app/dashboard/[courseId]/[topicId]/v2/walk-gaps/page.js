'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';

export default function WalkGapsPage() {
  const { courseId, topicId } = useParams();
  const router = useRouter();
  const { getToken } = useAuth();

  const [gaps, setGaps] = useState([]);
  const [currentGapIndex, setCurrentGapIndex] = useState(0);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const API = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    startGapsSession();
  }, []);

  async function startGapsSession() {
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/walkthrough/${topicId}/start-gaps`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (!data.session) {
        setGaps([]);
        setLoading(false);
        return;
      }

      setSession(data.session);
      setGaps(data.gaps || []);
      setMessages(data.session.messages || []);
      setLoading(false);

      if (!data.session.messages || data.session.messages.length === 0) {
        sendMessage('Begin', data.session.id);
      }
    } catch (err) {
      console.error('Failed to start gaps session:', err);
      setLoading(false);
    }
  }

  async function sendMessage(text = null, sessionId = null) {
    const messageText = text || input.trim();
    if (!messageText || streaming) return;

    const sid = sessionId || session?.id;
    if (!sid) return;

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
              }
            } catch (e) {}
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  useEffect(() => {
    if (inputRef.current && !streaming) inputRef.current.focus();
  }, [streaming]);

  const currentGap = gaps[currentGapIndex];

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading...</div>;
  }

  if (gaps.length === 0) {
    return (
      <div style={{ padding: '2rem', maxWidth: 700, margin: '0 auto' }}>
        <div style={{ position: 'fixed', top: 12, right: 16, background: '#2563eb', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, zIndex: 9999, letterSpacing: '0.5px' }}>v2</div>
        <div onClick={() => router.back()} style={{ fontSize: 13, color: '#6B6B6B', cursor: 'pointer', marginBottom: '1rem' }}>
          &larr; Back
        </div>
        <div style={{ fontSize: 13, color: '#8B6914', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
          Knowledge Walkthrough
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: '1rem' }}>
          Filling the Gaps
        </h1>
        <div style={{
          background: '#fff', border: '1px solid #E8E4DA', borderRadius: 12,
          padding: '2rem', textAlign: 'center',
        }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#4A7C59', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 15, fontWeight: 500 }}>Everything is solid.</div>
          <div style={{ fontSize: 13, color: '#6B6B6B', marginTop: 4 }}>No gaps to work on right now.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      maxWidth: 700, margin: '0 auto', fontFamily: 'var(--font-body)',
    }}>
      {/* Header */}
      <div style={{ padding: '1rem 2rem', borderBottom: '1px solid #E8E4DA' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, color: '#8B6914', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Knowledge Walkthrough
            </div>
            <div style={{ fontSize: 14, color: '#6B6B6B' }}>
              Filling the gaps
            </div>
          </div>
          <div onClick={() => router.back()} style={{
            fontSize: 13, color: '#6B6B6B', cursor: 'pointer',
            padding: '6px 12px', border: '1px solid #E8E4DA', borderRadius: 8,
          }}>
            Done
          </div>
        </div>

        {/* Gap indicator dots */}
        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          {gaps.map((_, i) => (
            <div key={i} style={{
              width: 10, height: 10, borderRadius: '50%',
              background: i < currentGapIndex ? '#4A7C59' : i === currentGapIndex ? '#8B6914' : '#E8E4DA',
            }} />
          ))}
        </div>
      </div>

      {/* Current gap context */}
      {currentGap && (
        <div style={{ padding: '1rem 2rem', background: '#f9f8f5', borderBottom: '1px solid #E8E4DA' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#6B6B6B', marginBottom: 4 }}>
            Working on:
          </div>
          <div style={{ fontSize: 14 }}>{currentGap.question}</div>
          <div style={{ fontSize: 12, color: '#6B6B6B', marginTop: 6 }}>
            You had: {currentGap.got}
          </div>
          <div style={{ fontSize: 12, color: '#C4972A', marginTop: 2 }}>
            Missing: {currentGap.missing}
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>
        {messages.filter(m => !(m.role === 'user' && m.content === 'Begin')).map((msg, i) => (
          <div key={i} style={{
            marginBottom: '1.25rem',
            maxWidth: msg.role === 'user' ? '80%' : '100%',
            marginLeft: msg.role === 'user' ? 'auto' : 0,
          }}>
            {msg.role === 'assistant' && (
              <div style={{ fontSize: 11, color: '#8B6914', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Open Path
              </div>
            )}
            <div style={{
              background: msg.role === 'user' ? '#f5f3ee' : '#fff',
              border: msg.role === 'user' ? 'none' : '1px solid #E8E4DA',
              borderRadius: 12, padding: '0.875rem 1rem',
              fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap',
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {streamingText && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 11, color: '#8B6914', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Open Path</div>
            <div style={{
              background: '#fff', border: '1px solid #E8E4DA', borderRadius: 12,
              padding: '0.875rem 1rem', fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap',
            }}>{streamingText}</div>
          </div>
        )}

        {streaming && !streamingText && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 11, color: '#8B6914', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Open Path</div>
            <div style={{
              background: '#fff', border: '1px solid #E8E4DA', borderRadius: 12,
              padding: '0.875rem 1rem', fontSize: 15, color: '#6B6B6B',
            }}>Thinking...</div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '1rem 2rem', borderTop: '1px solid #E8E4DA', background: '#fdfbf7' }}>
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
              fontSize: 14, fontFamily: 'var(--font-body)', cursor: streaming || !input.trim() ? 'default' : 'pointer',
              fontWeight: 500, whiteSpace: 'nowrap',
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
