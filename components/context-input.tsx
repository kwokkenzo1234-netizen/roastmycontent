"use client"

import { useState } from "react"
import { Plus, Minus } from "@phosphor-icons/react"

interface ContextInputProps {
  value: string
  onChange: (val: string) => void
}

export default function ContextInput({ value, onChange }: ContextInputProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        suppressHydrationWarning
        style={{
          background: "transparent",
          border: "none",
          padding: "0",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          color: isOpen ? "var(--ember)" : "var(--smoke)",
          fontFamily: "var(--font-jakarta)",
          fontWeight: 500,
          fontSize: "0.875rem",
          transition: "color 0.15s ease",
        }}
      >
        {isOpen ? (
          <Minus size={16} weight="bold" />
        ) : (
          <Plus size={16} weight="bold" />
        )}
        Ada yang perlu gue tau?{" "}
        <span style={{ color: "var(--smoke)", fontWeight: 400 }}>(opsional)</span>
      </button>

      {isOpen && (
        <div className="animate-fade-in-up" style={{ marginTop: "12px" }}>
          <textarea
            id="context-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="misal: logo gue emang sengaja di atas kepala, bukan glitch..."
            style={{
              width: "100%",
              background: "var(--ink-soft)",
              border: "1px solid var(--ink-border)",
              borderRadius: 0,
              color: "var(--white)",
              fontFamily: "var(--font-jakarta)",
              fontSize: "0.875rem",
              padding: "12px 14px",
              resize: "vertical",
              outline: "none",
              transition: "border-color 0.15s ease",
              lineHeight: 1.5,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--ember)"
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--ink-border)"
            }}
          />
          <div
            className="label-mono"
            style={{
              textAlign: "right",
              marginTop: "4px",
              fontSize: "0.65rem",
              color: value.length > 400 ? "#ff6b6b" : "var(--smoke)",
            }}
          >
            {value.length}/500
          </div>
          <p
            style={{
              color: "var(--smoke)",
              fontFamily: "var(--font-jakarta)",
              fontSize: "0.75rem",
              marginTop: "6px",
              lineHeight: 1.4,
            }}
          >
            Context ini bantu AI biar gak salah interpretasi konten lo.
          </p>
        </div>
      )}
    </div>
  )
}
