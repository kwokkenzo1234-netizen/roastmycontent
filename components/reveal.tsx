"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

interface RevealProps {
  children: ReactNode
  /** Stagger delay in ms (applied as transition-delay) */
  delay?: number
  className?: string
}

/**
 * Wraps children in a scroll-reveal container. Adds `.is-visible` once the
 * element enters the viewport (reveals once, then unobserves). Animation and
 * reduced-motion handling live in `.reveal` / `.reveal.is-visible` (globals.css).
 */
export default function Reveal({ children, delay = 0, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    // No IntersectionObserver (old env / SSR mismatch): show immediately.
    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true)
            observer.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const classes = ["reveal", isVisible ? "is-visible" : "", className ?? ""]
    .filter(Boolean)
    .join(" ")

  return (
    <div
      ref={ref}
      className={classes}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}
