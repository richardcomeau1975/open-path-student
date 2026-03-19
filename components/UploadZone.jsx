"use client";

import { useRef, useState } from "react";

const ALLOWED = [".pdf", ".pptx", ".docx", ".xlsx", ".txt", ".md"];

export default function UploadZone({ files, setFiles }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (newFiles) => {
    const valid = Array.from(newFiles).filter((f) => {
      const ext = f.name.includes(".")
        ? "." + f.name.split(".").pop().toLowerCase()
        : "";
      return ALLOWED.includes(ext);
    });
    setFiles((prev) => [...prev, ...valid].slice(0, 10));
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        style={{
          border: `2px dashed ${
            dragOver ? "var(--accent-gold)" : "var(--border-card)"
          }`,
          borderRadius: "var(--radius-lg)",
          padding: "40px 24px",
          textAlign: "center",
          cursor: "pointer",
          transition: "border-color 0.15s ease",
          backgroundColor: dragOver ? "#faf7f0" : "transparent",
        }}
      >
        <p
          style={{
            fontSize: "14px",
            color: "var(--text-muted)",
            marginBottom: "4px",
          }}
        >
          Drag and drop files here, or click to browse
        </p>
        <p
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
          }}
        >
          PDF, PPTX, DOCX, XLSX, TXT, MD — max 10 files, 50MB each
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.pptx,.docx,.xlsx,.txt,.md"
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div style={{ marginTop: "16px" }}>
          {files.map((file, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                backgroundColor: "#faf7f0",
                borderRadius: "var(--radius)",
                marginBottom: "6px",
                fontSize: "13px",
              }}
            >
              <span style={{ color: "var(--text-primary)" }}>{file.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(i);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "16px",
                  padding: "0 4px",
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
