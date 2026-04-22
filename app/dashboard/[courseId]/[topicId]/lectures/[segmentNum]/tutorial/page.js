'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import Header from '../../../../../../../components/Header';
import BackButton from '../../../../../../../components/BackButton';

const API = process.env.NEXT_PUBLIC_API_URL || '';

export default function SegmentTutorialPage() {
  const { courseId, topicId, segmentNum } = useParams();
  const router = useRouter();
  const { getToken, isLoaded } = useAuth();

  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [totalSegments, setTotalSegments] = useState(null);
  const messagesEndRef = useRef(null);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // Load content to get segment count
  useEffect(() => {
    if (!isLoaded) return;
    async function loadSegmentCount() {
      try {
        const token = await getToken();
        const content = await fetch(`${API}/api/topics/${topicId}/content`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await content.json();
        if (data.lecture_segments) {
          setTotalSegments(data.lecture_segments.length);
        }
      } catch {}
    }
    loadSegmentCount();
  }, [topicId, getToken, isLoaded]);

  // Start tutorial session
  useEffect(() => {
    if (!isLoaded || session) return;
    async function startSession() {
      try {
        const token = await getToken();
        const res = await fetch(`${API}/api/walkthrough/${topicId}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            mode: 'segment_tutorial',
            segment_number: parseInt(segmentNum, 10),
          }),
        });
        const data = await res.json();
        if (data.session) {
          setSession(data.session);
          setMessages(data.session.messages || []);

          // Auto-send "Begin" if no messages yet
          if (!data.session.messages || data.session.messages.length === 0) {
            sendMessage('Begin', data.session.id, token);
          }
        }
      } catch (err) {
        console.error('Failed to start tutorial session:', err);
      }
    }
    startSession();
  }, [topicId, segmentNum, getToken, isLoaded]);

  // Send message (streaming SSE)
  async function sendMessage(text, sessionId, tokenOverride) {
    const msg = text || input.trim();
    if (!msg || streaming) return;

    const sid = sessionId || session?.id;
    if (!sid) return;

    setStreaming(true);
    setInput('');
    setStreamingText('');

    // Add user message
    if (text !== 'Begin') {
      setMessages(prev => [...prev, { role: 'user', content: msg }]);
    }

    const token = tokenOverride || await getToken();

    try {
      const res = await fetch(`${API}/api/walkthrough/${topicId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ session_id: sid, message: msg }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'text') {
              fullResponse += event.text;
              setStreamingText(fullResponse);
            } else if (event.type === 'done') {
              setMessages(prev => [...prev, { role: 'assistant', content: fullResponse }]);
              setStreamingText('');
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error('Tutorial message failed:', err);
    }

    setStreaming(false);
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const nextSegNum = parseInt(segmentNum, 10) + 1;
  const hasNextSeg = totalSegments && nextSegNum <= totalSegments;

  return (
    <div style={{ minHeight: '100vh', background: '#fdfbf7', color: '#1a1a1a', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px', flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
        <BackButton href={`/dashboard/${courseId}/${topicId}/lectures/${segmentNum}`} />

        <div style={{ fontSize: 13, color: '#6B6B6B', marginTop: 8, marginBottom: 16 }}>
          Tutorial — Segment {segmentNum}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 16 }}>
          {messages.filter(m => m.role !== 'user' || m.content !== 'Begin').map((msg, i) => (
            <div
              key={i}
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: 12,
                fontSize: 14, lineHeight: 1.5,
                background: msg.role === 'user' ? '#f0ebe0' : '#ffffff',
                border: msg.role === 'user' ? '1px solid #E8E4DA' : '1px solid #E8E4DA',
                color: '#1a1a1a',
                whiteSpace: 'pre-wrap',
              }}
            >
              {msg.content}
            </div>
          ))}

          {streamingText && (
            <div style={{
              alignSelf: 'flex-start', maxWidth: '85%',
              padding: '10px 14px', borderRadius: 12,
              fontSize: 14, lineHeight: 1.5,
              background: '#ffffff', border: '1px solid #E8E4DA',
              color: '#1a1a1a', whiteSpace: 'pre-wrap',
            }}>
              {streamingText}<span style={{ opacity: 0.4 }}>▊</span>
            </div>
          )}

          {streaming && !streamingText && (
            <div style={{ color: '#6B6B6B', fontSize: 13, padding: '8px 14px' }}>
              Thinking...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{ borderTop: '1px solid #E8E4DA', paddingTop: 12, paddingBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your response..."
              disabled={streaming}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 8,
                border: '1px solid #E8E4DA', background: '#ffffff',
                color: '#1a1a1a', fontSize: 14, outline: 'none',
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || streaming}
              style={{
                padding: '10px 16px', borderRadius: 8,
                background: input.trim() ? '#8B6914' : '#E8E4DA',
                color: input.trim() ? '#fff' : '#6B6B6B',
                border: 'none', cursor: input.trim() ? 'pointer' : 'default',
                fontSize: 14, fontWeight: 500,
              }}
            >
              Send
            </button>
          </div>

          {/* Move on button */}
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <button
              onClick={() => {
                if (hasNextSeg) {
                  router.push(`/dashboard/${courseId}/${topicId}/lectures/${nextSegNum}`);
                } else {
                  router.push(`/dashboard/${courseId}/${topicId}/lectures`);
                }
              }}
              style={{
                padding: '8px 20px', borderRadius: 8,
                background: 'transparent', border: '1px solid #E8E4DA',
                color: '#9B8E82', cursor: 'pointer', fontSize: 13,
              }}
            >
              {hasNextSeg
                ? `I'm ready to move on → Lecture ${nextSegNum}`
                : '✓ All segments complete — Back to lectures'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
