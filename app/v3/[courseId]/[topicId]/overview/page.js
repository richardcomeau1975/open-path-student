"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "../../../../../lib/api";
import gsap from "gsap";

export default function VisualOverviewPage() {
  const { courseId, topicId } = useParams();
  const router = useRouter();
  const { getToken } = useAuth();

  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioRef = useRef(null);
  const slideRef = useRef(null);

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
  }, [topicId, getToken]);

  const slides = content?.visual_overview_slides || [];
  const images = content?.visual_overview_images || [];
  const audioSegments = content?.visual_overview_audio || [];

  // Count slides from whichever source has data
  const slideCount = Math.max(slides.length, images.length);

  // GSAP fade transition on slide change
  useEffect(() => {
    if (slideRef.current && slideCount > 0) {
      gsap.fromTo(
        slideRef.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }
      );
    }
  }, [currentSlide]);

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

  const handleAudioEnded = () => {
    if (currentSlide < slideCount - 1) {
      // Fade out, then advance
      if (slideRef.current) {
        gsap.to(slideRef.current, {
          opacity: 0,
          y: -8,
          duration: 0.4,
          ease: "power2.in",
          onComplete: () => {
            setCurrentSlide((prev) => prev + 1);
            setAudioProgress(0);
          },
        });
      } else {
        setCurrentSlide((prev) => prev + 1);
        setAudioProgress(0);
      }
    } else {
      setPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current && audioRef.current.duration) {
      setAudioProgress(audioRef.current.currentTime / audioRef.current.duration);
    }
  };

  // Auto-play next audio when slide changes
  useEffect(() => {
    if (playing && audioRef.current && audioSegments[currentSlide]) {
      audioRef.current.load();
      setTimeout(() => {
        audioRef.current.play().catch(() => {});
      }, 300); // Small delay for GSAP fade-in
    }
  }, [currentSlide]);

  const goToSlide = (index) => {
    if (slideRef.current) {
      gsap.to(slideRef.current, {
        opacity: 0,
        duration: 0.3,
        onComplete: () => {
          setCurrentSlide(index);
          setAudioProgress(0);
          if (audioRef.current) {
            audioRef.current.load();
            if (playing) {
              setTimeout(() => audioRef.current.play().catch(() => {}), 300);
            }
          }
        },
      });
    } else {
      setCurrentSlide(index);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", fontFamily: "Inter, sans-serif", color: "#6B6B6B" }}>
        Loading visual overview...
      </div>
    );
  }

  if (!slideCount) {
    return (
      <div style={{ padding: "24px 32px", maxWidth: "1000px", margin: "0 auto" }}>
        <button onClick={() => router.back()} style={backBtnStyle}>
          &larr; Back
        </button>
        <p style={{ fontFamily: "Inter, sans-serif", color: "#6B6B6B", marginTop: "20px" }}>
          No visual overview content available yet.
        </p>
      </div>
    );
  }

  const currentAnchorText = slides[currentSlide]?.anchor_text || "";
  const currentImage = images[currentSlide]?.url;

  return (
    <div style={{ padding: "24px 32px", maxWidth: "1000px", margin: "0 auto" }}>
      <button onClick={() => router.back()} style={backBtnStyle}>
        &larr; Back
      </button>

      <div style={{ marginTop: "16px", marginBottom: "24px" }}>
        <div style={{
          fontSize: "13px",
          color: "#8B6914",
          fontFamily: "Inter, sans-serif",
          fontWeight: 500,
          letterSpacing: "0.5px",
        }}>
          VISUAL OVERVIEW
        </div>
        <h1 style={{
          fontFamily: "'Lora', serif",
          fontWeight: 600,
          fontSize: "28px",
          marginTop: "4px",
        }}>
          Build Your Foundation
        </h1>
      </div>

      {/* Slide card with GSAP transitions */}
      <div
        ref={slideRef}
        style={{
          background: "#FDFBF5",
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid #E8E4DA",
        }}
      >
        {/* Anchor text */}
        {currentAnchorText && (
          <div style={{
            padding: "32px 36px 20px",
            textAlign: "center",
          }}>
            <p style={{
              fontSize: "24px",
              fontFamily: "'Lora', serif",
              fontWeight: 600,
              fontStyle: "italic",
              color: "#1a1a1a",
              lineHeight: 1.35,
              margin: 0,
            }}>
              {currentAnchorText}
            </p>
          </div>
        )}

        {/* Image */}
        {currentImage && (
          <div style={{ padding: "0 20px 20px" }}>
            <img
              src={currentImage}
              alt={currentAnchorText || `Slide ${currentSlide + 1}`}
              style={{
                width: "100%",
                borderRadius: 10,
                display: "block",
              }}
            />
          </div>
        )}

        {/* If no image but has text, add bottom padding */}
        {!currentImage && currentAnchorText && (
          <div style={{ paddingBottom: "40px" }} />
        )}
      </div>

      {/* Audio element (hidden) */}
      {audioSegments[currentSlide] && (
        <audio
          ref={audioRef}
          src={audioSegments[currentSlide]?.url}
          onEnded={handleAudioEnded}
          onTimeUpdate={handleTimeUpdate}
        />
      )}

      {/* Controls */}
      <div style={{
        marginTop: "20px",
        background: "#ffffff",
        border: "1px solid #E8E4DA",
        borderRadius: "12px",
        padding: "16px 20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            onClick={handlePlayPause}
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: "#9B8E82",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {playing ? "❚❚" : "▶"}
          </button>

          <div style={{ flex: 1 }}>
            <div style={{
              height: "6px",
              background: "#E8E4DA",
              borderRadius: "3px",
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                width: `${((currentSlide + audioProgress) / slideCount) * 100}%`,
                background: "#8B6914",
                borderRadius: "3px",
                transition: "width 0.3s ease",
              }} />
            </div>
          </div>

          <span style={{
            fontSize: "14px",
            color: "#6B6B6B",
            fontFamily: "Inter, sans-serif",
            whiteSpace: "nowrap",
          }}>
            {currentSlide + 1} / {slideCount}
          </span>
        </div>

        {/* Slide dots */}
        <div style={{
          display: "flex",
          gap: "8px",
          justifyContent: "center",
          marginTop: "12px",
        }}>
          {Array.from({ length: slideCount }).map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                border: "none",
                background: i === currentSlide ? "#8B6914" : i < currentSlide ? "#4A7C59" : "#E8E4DA",
                cursor: "pointer",
                padding: 0,
              }}
            />
          ))}
        </div>
      </div>
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
