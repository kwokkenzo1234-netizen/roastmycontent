"use client"

import { useEffect, useRef, useState } from "react"
import { getCharacter } from "@/lib/characters"

const STATUS_MESSAGES = [
  "Lagi nonton video lo...",
  "Ngecek sound effect cringe...",
  "Nyari momen memalukan...",
  "Ngitung berapa kali lo salah angle...",
  "Nyusun kata-kata pedes...",
  "Ngebandingin sama konten yang lebih bagus...",
  "Hampir selesai ngehina lo...",
]

interface LoadingStateProps {
  characterId: string
}

export default function LoadingState({ characterId }: LoadingStateProps) {
  const [messageIdx, setMessageIdx] = useState(0)
  const [progress, setProgress] = useState(5)
  const character = getCharacter(characterId)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Rotate messages every 4.5 seconds
    intervalRef.current = setInterval(() => {
      setMessageIdx((prev) => (prev + 1) % STATUS_MESSAGES.length)
    }, 4500)

    // Slowly fill progress bar (fake, capped at 90%)
    progressRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return 90
        return prev + Math.random() * 3
      })
    }, 800)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (progressRef.current) clearInterval(progressRef.current)
    }
  }, [])

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--ink)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
      }}
    >
      {/* Ember pulse orb */}
      <div style={{ position: "relative", marginBottom: "48px" }}>
        <div
          className="animate-pulse-ember"
          style={{
            width: "80px",
            height: "80px",
            background: "var(--ember)",
            borderRadius: "50%",
          }}
        />
        {/* Scan lines */}
        <div
          style={{
            position: "absolute",
            bottom: "-20px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "120px",
            height: "3px",
            background: "var(--ink-soft)",
            overflow: "hidden",
          }}
        >
          <div
            className="animate-scan-line"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "30%",
              height: "100%",
              background: "linear-gradient(90deg, transparent, var(--ember), transparent)",
            }}
          />
        </div>
      </div>

      {/* Film strip dots */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "40px",
          marginTop: "16px",
        }}
      >
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            style={{
              width: "8px",
              height: "8px",
              background: i === messageIdx % 5 ? "var(--ember)" : "var(--ink-border)",
              transition: "background 0.3s ease",
              borderRadius: "1px",
            }}
          />
        ))}
      </div>

      {/* Status text */}
      <p
        key={messageIdx}
        style={{
          fontFamily: "var(--font-space-mono)",
          fontSize: "1.1rem",
          color: "var(--white)",
          textAlign: "center",
          marginBottom: "16px",
          animation: "fadeIn 0.4s ease",
        }}
      >
        {STATUS_MESSAGES[messageIdx]}
      </p>

      {/* Character label */}
      {character && (
        <p
          className="label-mono"
          style={{
            textAlign: "center",
            color: "var(--smoke)",
            letterSpacing: "0.1em",
            fontSize: "0.65rem",
          }}
        >
          {character.name.toUpperCase()} LAGI NGOREK-NGOREK AIBMU
        </p>
      )}

      {/* Progress bar at bottom */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: "4px",
          background: "var(--ink-soft)",
        }}
      >
        <div
          style={{
            height: "100%",
            background: "var(--ember)",
            width: `${progress}%`,
            transition: "width 0.8s ease",
          }}
        />
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
