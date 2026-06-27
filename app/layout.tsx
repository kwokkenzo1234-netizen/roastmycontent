import type { Metadata } from "next"
import { Unbounded, Plus_Jakarta_Sans, Space_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ClerkProvider } from "@clerk/nextjs"
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site"
import "./globals.css"

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
  weight: ["400", "700", "800", "900"],
  display: "swap",
  preload: false,
})

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
})

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  preload: false,
})

const OG_IMAGE = {
  url: "/api/og",
  width: 1080,
  height: 1080,
  alt: "RoastMyContent — AI roast konten creator Indonesia",
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "RoastMyContent — Berani Upload? Berani Diroast.",
  description: SITE_DESCRIPTION,
  keywords: ["roast", "konten", "creator", "AI", "Indonesia", "feedback", "video"],
  alternates: { canonical: "/" },
  openGraph: {
    title: "RoastMyContent — Berani Upload? Berani Diroast.",
    description: "AI nonton video lo, terus ngehina kontennya secara jujur & lucu.",
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    locale: "id_ID",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "RoastMyContent — Berani Upload? Berani Diroast.",
    description: "AI nonton video lo, terus ngehina kontennya secara jujur & lucu.",
    images: [OG_IMAGE.url],
  },
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "MultimediaApplication",
  inLanguage: "id-ID",
  offers: { "@type": "Offer", price: "0", priceCurrency: "IDR" },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
    <html
      lang="id"
      className={`${unbounded.variable} ${plusJakartaSans.variable} ${spaceMono.variable}`}
    >
      <body className="min-h-dvh antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
        <Analytics />
      </body>
    </html>
    </ClerkProvider>
  )
}
