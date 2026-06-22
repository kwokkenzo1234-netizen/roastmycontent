"use client"

import { useState, useCallback } from "react"
import { UploadSimple, VideoCamera, X, CheckCircle, CircleNotch } from "@phosphor-icons/react"
import { useUploadThing } from "@/lib/uploadthing"

interface UploadZoneProps {
  // Called once file is fully uploaded to UploadThing & URL is ready
  onUploadComplete: (fileUrl: string, fileKey: string, file: File) => void
  onUploadError: (err: Error) => void
  onFileSelect?: (file: File) => void
  // Controlled state from parent — to show/clear selected file
  selectedFile: File | null
  onClear: () => void
  disabled?: boolean
}

const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/webm"]
const MAX_BYTES = 100 * 1024 * 1024 // 100MB client-side guard (match server cap)

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function UploadZone({
  onUploadComplete,
  onUploadError,
  onFileSelect,
  selectedFile,
  onClear,
  disabled = false,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [currentFile, setCurrentFile] = useState<File | null>(null)

  const { startUpload } = useUploadThing("videoUploader", {
    onUploadProgress: (progress: number) => {
      setUploadProgress(progress)
    },
    onClientUploadComplete: (res) => {
      setIsUploading(false)
      setUploadProgress(0)
      if (res && res[0] && currentFile) {
        // Gunakan ufsUrl sesuai dengan rekomendasi UploadThing
        const fileUrl = res[0].ufsUrl || res[0].url
        onUploadComplete(fileUrl, res[0].key, currentFile)
      }
    },
    onUploadError: (err: Error) => {
      setIsUploading(false)
      setUploadProgress(0)
      // Detect token/config error dan wrap dengan pesan yang jelas
      const msg = err.message ?? ""
      if (msg.toLowerCase().includes("invalid token") || msg.toLowerCase().includes("token")) {
        onUploadError(
          new Error(
            "UPLOADTHING_TOKEN belum di-set atau formatnya salah. " +
            "Isi di .env.local lalu restart dev server."
          )
        )
      } else {
        onUploadError(err)
      }
    },
  })

  const validate = useCallback((file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return "Format tidak didukung. Pakai MP4, MOV, atau WebM."
    }
    if (file.size > MAX_BYTES) {
      return "Video kegedean. Maksimal 100MB."
    }
    return null
  }, [])

  const handleFile = useCallback(
    async (file: File) => {
      setValidationError(null)
      const err = validate(file)
      if (err) {
        setValidationError(err)
        return
      }

      setCurrentFile(file)

      // Check if we should use direct path (localhost only for fast dev, production always uses UploadThing)
      const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
      const useDirect = isLocal

      if (!useDirect) {
        setIsUploading(true)
        setUploadProgress(0)
        await startUpload([file])
      } else {
        // Direct Path: Simulate a fast upload progress bar (0% to 100% over 800ms)
        setIsUploading(true)
        setUploadProgress(0)
        
        let progress = 0
        const interval = setInterval(() => {
          progress += 10
          if (progress >= 100) {
            clearInterval(interval)
            setIsUploading(false)
            setUploadProgress(0)
            if (onFileSelect) {
              onFileSelect(file)
            }
          } else {
            setUploadProgress(progress)
          }
        }, 80)
      }
    },
    [validate, startUpload, onFileSelect]
  )

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (disabled || isUploading) return
      const file = e.dataTransfer.files[0]
      if (file) await handleFile(file)
    },
    [handleFile, disabled, isUploading]
  )

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || isUploading) return
    const file = e.target.files?.[0]
    if (file) await handleFile(file)
    // Reset input so same file can be re-selected
    e.target.value = ""
  }

  const handleClear = () => {
    setValidationError(null)
    setUploadProgress(0)
    setIsUploading(false)
    onClear()
  }

  // ── UPLOADING STATE ────────────────────────────────────────────────────────
  if (isUploading) {
    return (
      <div style={{
        background: "var(--ink-soft)",
        border: "2px solid var(--ember)",
        padding: "32px 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "16px",
      }}>
        <CircleNotch
          size={36}
          weight="bold"
          style={{ color: "var(--ember)", animation: "spin 1s linear infinite" }}
        />
        <div style={{ textAlign: "center" }}>
          <p style={{
            fontFamily: "var(--font-jakarta)",
            fontWeight: 600,
            fontSize: "0.95rem",
            color: "var(--white)",
            marginBottom: "4px",
          }}>
            Uploading video lo...
          </p>
          <p className="label-mono">{uploadProgress}%</p>
        </div>
        {/* Progress bar */}
        <div style={{
          width: "100%",
          height: "3px",
          background: "var(--ink-border)",
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            background: "var(--ember)",
            width: `${uploadProgress}%`,
            transition: "width 0.3s ease",
          }} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── UPLOADED / SELECTED STATE ──────────────────────────────────────────────
  if (selectedFile) {
    return (
      <div style={{
        background: "var(--ink-soft)",
        border: "2px solid var(--ember)",
        padding: "24px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        minWidth: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <CheckCircle size={26} weight="fill" style={{ color: "var(--ember)", flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <p style={{
              fontFamily: "var(--font-jakarta)",
              fontWeight: 600,
              fontSize: "0.875rem",
              color: "var(--white)",
              marginBottom: "2px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {selectedFile.name}
            </p>
            <p className="label-mono" style={{ fontSize: "0.6rem" }}>
              {formatBytes(selectedFile.size)} · siap diroast
            </p>
          </div>
        </div>
        <button
          onClick={handleClear}
          disabled={disabled}
          aria-label="Hapus file"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--smoke)",
            cursor: "pointer",
            flexShrink: 0,
            padding: "4px",
          }}
        >
          <X size={18} weight="bold" />
        </button>
      </div>
    )
  }

  // ── DROP ZONE (idle) ───────────────────────────────────────────────────────
  return (
    <div>
      <label
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          minHeight: "200px",
          padding: "40px 20px",
          border: `2px dashed ${isDragging ? "var(--ember)" : "rgba(255,77,28,0.35)"}`,
          background: isDragging ? "rgba(255,77,28,0.05)" : "var(--ink-soft)",
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "all 0.15s ease",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <input
          id="video-upload"
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          className="sr-only"
          onChange={handleInputChange}
          disabled={disabled}
        />

        <div style={{
          width: 60,
          height: 60,
          background: isDragging ? "var(--ember)" : "rgba(255,77,28,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.15s ease",
        }}>
          {isDragging ? (
            <VideoCamera size={30} weight="fill" style={{ color: "var(--ink)" }} />
          ) : (
            <UploadSimple size={30} weight="bold" style={{ color: "var(--ember)" }} />
          )}
        </div>

        <div style={{ textAlign: "center" }}>
          <p style={{
            fontFamily: "var(--font-jakarta)",
            fontWeight: 600,
            fontSize: "1rem",
            color: "var(--white)",
            marginBottom: "4px",
          }}>
            {isDragging ? "Lepas di sini!" : "Drop video lo di sini"}
          </p>
          <p className="label-mono" style={{ fontSize: "0.62rem" }}>
            max 3 menit · MP4 / MOV / WebM · max 100MB
          </p>
        </div>

        <span style={{
          background: "var(--ember)",
          color: "var(--ink)",
          fontFamily: "var(--font-unbounded)",
          fontWeight: 700,
          fontSize: "0.72rem",
          padding: "8px 20px",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          pointerEvents: "none",
        }}>
          Pilih File
        </span>
      </label>

      {validationError && (
        <p style={{
          color: "#ff6b6b",
          fontFamily: "var(--font-space-mono)",
          fontSize: "0.72rem",
          marginTop: "8px",
          paddingLeft: "4px",
        }}>
          ⚠ {validationError}
        </p>
      )}
    </div>
  )
}
