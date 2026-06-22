"use client"

import { useEffect, useState } from "react"
import { characters, getWeekendCharacter, weekendCharacters, WEEKEND_TEST_MODE, type Character, type WeekendCharacter } from "@/lib/characters"

interface CharacterPickerProps {
  selectedId: string | null
  onSelect: (id: string) => void
}

interface CharacterButtonProps {
  char: Character
  isSelected: boolean
  onSelect: (id: string) => void
  isWeekend?: boolean
}

function CharacterButton({ char, isSelected, onSelect, isWeekend = false }: CharacterButtonProps) {
  const isDefault = char.id === "mentor-jujur"
  const isCiciPik = char.id === "cici-pik"

  return (
    <button
      onClick={() => onSelect(char.id)}
      aria-pressed={isSelected}
      suppressHydrationWarning
      className={`char-btn${isWeekend && !isSelected ? " weekend-glow" : ""}`}
      style={{
        background: "var(--ink-soft)",
        border: isSelected || isWeekend
          ? "2px solid var(--ember)"
          : "2px solid var(--ink-border)",
        borderRadius: 0,
        padding: "18px 14px 16px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "8px",
        textAlign: "left",
        position: "relative",
        overflow: "hidden",
        width: "100%",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        boxShadow: isSelected
          ? "0 0 18px rgba(255, 77, 28, 0.12)"
          : "none",
      }}
    >
      {/* Ember top bar (selected) */}
      {isSelected && (
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: "3px",
          background: "var(--ember)",
        }} />
      )}

      {/* DEFAULT badge — Mentor Jujur */}
      {isDefault && (
        <div style={{
          position: "absolute",
          top: "8px",
          right: "8px",
          background: "var(--acid)",
          color: "var(--ink)",
          fontFamily: "var(--font-space-mono)",
          fontSize: "0.5rem",
          fontWeight: 700,
          letterSpacing: "0.08em",
          padding: "1px 5px",
          textTransform: "uppercase",
          lineHeight: "16px",
        }}>
          DEFAULT
        </div>
      )}

      {/* SELECTED badge */}
      {isSelected && (
        <div style={{
          position: "absolute",
          top: "8px",
          right: isDefault ? "62px" : "8px",
          background: "var(--ember)",
          color: "var(--ink)",
          fontFamily: "var(--font-space-mono)",
          fontSize: "0.5rem",
          fontWeight: 700,
          letterSpacing: "0.08em",
          padding: "1px 5px",
          textTransform: "uppercase",
          lineHeight: "16px",
        }}>
          SELECTED
        </div>
      )}

      {/* Emoji */}
      <span
        style={{ fontSize: "2rem", lineHeight: 1, marginTop: "4px" }}
        className={isSelected ? "char-emoji is-selected" : "char-emoji"}
      >
        {char.emoji}
      </span>

      {/* Name */}
      <span style={{
        fontFamily: "var(--font-unbounded)",
        fontWeight: 700,
        fontSize: "0.75rem",
        color: isSelected ? "var(--ember)" : "var(--white)",
        lineHeight: 1.2,
        letterSpacing: "0.01em",
        transition: "color 0.15s ease",
        // Cici PIK is all-lowercase already via data, just render as-is
        textTransform: isCiciPik ? "none" : "uppercase",
      }}>
        {isCiciPik ? char.name : char.name.toUpperCase()}
      </span>

      {/* Description — Cici PIK stays lowercase */}
      <span style={{
        fontFamily: "var(--font-jakarta)",
        fontWeight: 400,
        fontSize: "0.72rem",
        color: "var(--smoke)",
        lineHeight: 1.4,
        textTransform: isCiciPik ? "lowercase" : "none",
      }}>
        {isCiciPik ? char.description.toLowerCase() : char.description}
      </span>
    </button>
  )
}

export default function CharacterPicker({ selectedId, onSelect }: CharacterPickerProps) {
  // Karakter weekend bergantung tanggal → hitung di client biar tidak mismatch SSR.
  // Senin-Kamis getWeekendCharacter() return null → slot tidak dirender sama sekali.
  // ⚠️ WEEKEND_TEST_MODE true → tampilkan SEMUA karakter weekend buat tes.
  const [weekendList, setWeekendList] = useState<WeekendCharacter[]>([])

  useEffect(() => {
    if (WEEKEND_TEST_MODE) {
      setWeekendList(weekendCharacters)
    } else {
      const wc = getWeekendCharacter()
      setWeekendList(wc ? [wc] : [])
    }
  }, [])

  return (
    <>
      <style>{`
        /* Emoji micro-interaksi — SEMUA karakter sama: pop halus pas hover,
           pop sekali pas kepilih. Gak ada loop idle (konsisten, gak ribut). */
        .char-emoji {
          display: inline-block;
          transform-origin: center bottom;
          transition: transform 0.16s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .char-btn:hover .char-emoji {
          transform: scale(1.14);
        }
        .char-btn:active .char-emoji {
          transform: scale(0.94);
        }
        .char-emoji.is-selected {
          animation: emoji-pop 0.34s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        @keyframes emoji-pop {
          0% { transform: scale(1); }
          55% { transform: scale(1.24); }
          100% { transform: scale(1); }
        }
        .char-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        @media (min-width: 900px) {
          .char-grid {
            grid-template-columns: 1fr 1fr 1fr;
          }
        }
        @keyframes weekend-pulse {
          0%, 100% { border-color: var(--ember); box-shadow: 0 0 8px rgba(255, 77, 28, 0.18); }
          50% { border-color: var(--ember-deep); box-shadow: 0 0 22px rgba(255, 77, 28, 0.5); }
        }
        .weekend-glow {
          animation: weekend-pulse 2s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .char-emoji,
          .char-btn:hover .char-emoji,
          .char-btn:active .char-emoji {
            transition: none;
            transform: none;
          }
          .char-emoji.is-selected,
          .weekend-glow {
            animation: none;
          }
        }
      `}</style>

      <div className="char-grid">
        {characters.map((char) => (
          <CharacterButton
            key={char.id}
            char={char}
            isSelected={selectedId === char.id}
            onSelect={onSelect}
          />
        ))}
      </div>

      {/* Weekend Special — hanya muncul Jumat-Minggu WIB, berganti otomatis tiap minggu.
          WEEKEND_TEST_MODE → semua karakter weekend tampil sekaligus. */}
      {weekendList.length > 0 && (
        <div style={{ marginTop: "18px" }}>
          <p
            className="label-mono"
            style={{
              color: "var(--ember)",
              marginBottom: "8px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            WEEKEND SPECIAL 🎲{WEEKEND_TEST_MODE ? " — TEST MODE (semua)" : ""}
          </p>
          {WEEKEND_TEST_MODE ? (
            <div className="char-grid">
              {weekendList.map((wc) => (
                <CharacterButton
                  key={wc.id}
                  char={wc}
                  isSelected={selectedId === wc.id}
                  onSelect={onSelect}
                  isWeekend
                />
              ))}
            </div>
          ) : (
            <>
              {/* Bungkus di grid yang sama → kartu weekend tunggal seukuran 1 sel,
                  seimbang dgn kartu utama (bukan full-width melar). */}
              <div className="char-grid">
                <CharacterButton
                  char={weekendList[0]}
                  isSelected={selectedId === weekendList[0].id}
                  onSelect={onSelect}
                  isWeekend
                />
              </div>
              <p
                style={{
                  marginTop: "8px",
                  fontFamily: "var(--font-jakarta)",
                  fontSize: "0.72rem",
                  color: "var(--smoke)",
                }}
              >
                Hadir sampai Minggu malam
              </p>
            </>
          )}
        </div>
      )}
    </>
  )
}
