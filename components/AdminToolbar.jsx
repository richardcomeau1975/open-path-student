"use client";

import { useState, useRef } from "react";
import { useAuth } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const bar = {
  background: "#f5f0e8",
  border: "1px solid #E8E4DA",
  borderRadius: 10,
  padding: "10px 14px",
  marginBottom: 10,
  fontFamily: "Inter, sans-serif",
};

const btnBase = {
  border: "none",
  borderRadius: 6,
  padding: "4px 10px",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "Inter, sans-serif",
};

const btn = { ...btnBase, background: "#9B8E82", color: "#fff" };
const btnOutline = { ...btnBase, background: "transparent", color: "#9B8E82", border: "1px solid #E8E4DA" };
const btnGreen = { ...btnBase, background: "#4A7C59", color: "#fff" };
const btnRed = { ...btnBase, background: "transparent", color: "#c0392b", border: "1px solid #c0392b" };

const badge = (exists) => ({
  display: "inline-block",
  fontSize: 11,
  fontWeight: 500,
  padding: "2px 8px",
  borderRadius: 6,
  background: exists ? "#e8f5e9" : "#f5f5f5",
  color: exists ? "#4A7C59" : "#999",
});

export default function AdminToolbar({
  topicId,
  outputType,
  label,
  showTestPrompt = false,
  downstreamLabel = null,
  onRefresh,
  accept = "*",
}) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(null); // which action is loading
  const [testPromptOpen, setTestPromptOpen] = useState(false);
  const [testPromptText, setTestPromptText] = useState("");
  const [status, setStatus] = useState(null); // {exists, file_count}
  const [error, setError] = useState("");
  const [viewOpen, setViewOpen] = useState(false);
  const [viewContent, setViewContent] = useState("");
  const fileRef = useRef(null);

  // Load status on mount
  useState(() => {
    loadStatus();
  });

  async function authFetch(path, opts = {}) {
    const token = await getToken();
    const headers = { ...(opts.headers || {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_URL}${path}`, { ...opts, headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status}: ${text}`);
    }
    return res.json();
  }

  async function loadStatus() {
    try {
      const data = await authFetch(`/api/topics/${topicId}/admin/status`);
      const out = data.outputs?.[outputType];
      if (out) setStatus(out);
    } catch (e) {
      // silently fail — toolbar still renders
    }
  }

  const pollRef = useRef(null);

  function startPolling() {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const prev = status?.exists;
      await loadStatus();
      // Check if status changed — if so, stop polling and refresh
      // We re-read status inside loadStatus, so check after
    }, 5000);
    // Also set a max polling duration of 10 minutes
    setTimeout(() => stopPolling(), 600000);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  // Watch for status changes while polling — stop when output appears
  useEffect(() => {
    if (pollRef.current && status?.exists && loading) {
      stopPolling();
      setLoading(null);
      if (onRefresh) onRefresh();
    }
  }, [status]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, []);

  async function doAction(actionName, fn) {
    setLoading(actionName);
    setError("");
    try {
      await fn();
      await loadStatus();
      if (onRefresh) onRefresh();
    } catch (e) {
      setError(e.message);
    }
    setLoading(null);
  }

  // Fire-and-forget action that starts polling
  async function doBackgroundAction(actionName, fn) {
    setLoading(actionName);
    setError("");
    try {
      await fn();
      startPolling();
    } catch (e) {
      setError(e.message);
      setLoading(null);
    }
  }

  async function handleReplace(files) {
    await doAction("replace", async () => {
      const token = await getToken();
      const form = new FormData();
      for (const f of files) form.append("files", f);
      const res = await fetch(
        `${API_URL}/api/topics/${topicId}/admin/outputs/${outputType}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        }
      );
      if (!res.ok) throw new Error(await res.text());
    });
  }

  async function handleGenerate() {
    await doBackgroundAction("generate", async () => {
      await authFetch(`/api/topics/${topicId}/admin/generate/${outputType}`, {
        method: "POST",
      });
    });
  }

  async function handleTestPrompt() {
    if (!testPromptText.trim()) return;
    await doBackgroundAction("test", async () => {
      await authFetch(
        `/api/topics/${topicId}/admin/generate-test/${outputType}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: testPromptText }),
        }
      );
    });
  }

  async function handleClear() {
    await doAction("clear", async () => {
      await authFetch(`/api/topics/${topicId}/admin/outputs/${outputType}`, {
        method: "DELETE",
      });
    });
  }

  async function handleDownstream() {
    await doBackgroundAction("downstream", async () => {
      await authFetch(
        `/api/topics/${topicId}/admin/generate-from/${outputType}`,
        { method: "POST" }
      );
    });
  }

  async function handleClearDownstream() {
    await doAction("clearing downstream", async () => {
      await authFetch(
        `/api/topics/${topicId}/admin/clear-from/${outputType}`,
        { method: "DELETE" }
      );
    });
  }

  async function handleView() {
    setError("");
    try {
      const data = await authFetch(`/api/topics/${topicId}/admin/view/${outputType}`);
      setViewContent(data.content || JSON.stringify(data, null, 2));
      setViewOpen(true);
    } catch (e) {
      setError(e.message);
    }
  }

  const exists = status?.exists;
  const fileCount = status?.file_count || 0;
  const isLoading = loading !== null;

  return (
    <div style={bar}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
          <span style={badge(exists)}>
            {exists
              ? fileCount > 1
                ? `${fileCount} files`
                : "Exists"
              : "Empty"}
          </span>
          {loading && (
            <span style={{ fontSize: 11, color: "#8B6914" }}>
              {loading}...
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {/* View */}
          {exists && (
            <button
              style={btnOutline}
              onClick={() => viewOpen ? setViewOpen(false) : handleView()}
              disabled={isLoading}
            >
              {viewOpen ? "Hide" : "View"}
            </button>
          )}

          {/* Replace */}
          <label
            style={{
              ...btn,
              display: "inline-flex",
              alignItems: "center",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            Replace
            <input
              ref={fileRef}
              type="file"
              accept={accept}
              multiple={
                outputType === "visual_overview_images" ||
                outputType === "narration_audio"
              }
              onChange={(e) => {
                const files = Array.from(e.target.files);
                if (files.length > 0) handleReplace(files);
                e.target.value = "";
              }}
              style={{ display: "none" }}
              disabled={isLoading}
            />
          </label>

          {/* Generate */}
          <button
            style={btn}
            onClick={handleGenerate}
            disabled={isLoading}
          >
            {loading === "generate" ? "..." : "Generate"}
          </button>

          {/* Test Prompt */}
          {showTestPrompt && (
            <button
              style={btnOutline}
              onClick={() => setTestPromptOpen(!testPromptOpen)}
              disabled={isLoading}
            >
              Test Prompt
            </button>
          )}

          {/* Clear */}
          {exists && (
            <button
              style={btnRed}
              onClick={handleClear}
              disabled={isLoading}
            >
              {loading === "clear" ? "..." : "Clear"}
            </button>
          )}

          {/* Downstream */}
          {downstreamLabel && exists && (
            <button
              style={btnGreen}
              onClick={handleDownstream}
              disabled={isLoading}
            >
              {loading === "downstream" ? "..." : downstreamLabel}
            </button>
          )}

          {/* Clear downstream */}
          {downstreamLabel && (
            <button
              style={btnRed}
              onClick={handleClearDownstream}
              disabled={isLoading}
            >
              {loading === "clearing downstream" ? "..." : "Clear downstream"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ color: "#c0392b", fontSize: 12, marginTop: 6 }}>
          {error}
        </div>
      )}

      {/* View content */}
      {viewOpen && viewContent && (
        <div style={{ marginTop: 8 }}>
          <pre style={{
            background: "#fff",
            border: "1px solid #E8E4DA",
            borderRadius: 8,
            padding: 12,
            fontSize: 12,
            maxHeight: 300,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            wordWrap: "break-word",
            fontFamily: "monospace",
          }}>
            {viewContent}
          </pre>
          <div style={{ marginTop: 4, fontSize: 11, color: "#6B6B6B" }}>
            {viewContent.split(/\s+/).length} words · {viewContent.length} chars
          </div>
        </div>
      )}

      {/* Test prompt textarea */}
      {testPromptOpen && (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={testPromptText}
            onChange={(e) => setTestPromptText(e.target.value)}
            placeholder="Paste your test prompt here..."
            style={{
              width: "100%",
              minHeight: 100,
              padding: 10,
              border: "1px solid #E8E4DA",
              borderRadius: 8,
              fontFamily: "Inter, sans-serif",
              fontSize: 13,
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
          <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
            <button
              style={btnGreen}
              onClick={handleTestPrompt}
              disabled={isLoading || !testPromptText.trim()}
            >
              {loading === "test" ? "Running..." : "Run with this prompt"}
            </button>
            <button
              style={btnOutline}
              onClick={() => setTestPromptOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
