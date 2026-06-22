import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Ketentuan Layanan — RoastMyContent",
  description: "Ketentuan penggunaan RoastMyContent.",
  alternates: { canonical: "/terms" },
}

// Tanggal efektif. Update kalau isi ketentuan berubah.
const LAST_UPDATED = "18 Juni 2026"

export default function TermsPage() {
  return (
    <main style={{ maxWidth: "720px", margin: "0 auto", padding: "32px 20px 80px" }}>
      <Link
        href="/"
        className="label-mono"
        style={{ color: "var(--ember)", textDecoration: "none", fontSize: "0.7rem" }}
      >
        ← Balik ke RoastMyContent
      </Link>

      <h1
        style={{
          fontFamily: "var(--font-unbounded)",
          fontWeight: 800,
          fontSize: "clamp(1.6rem, 5vw, 2.4rem)",
          marginTop: "20px",
          marginBottom: "6px",
        }}
      >
        KETENTUAN LAYANAN
      </h1>
      <p className="label-mono" style={{ color: "var(--smoke)", fontSize: "0.7rem", marginBottom: "28px" }}>
        Terakhir diperbarui: {LAST_UPDATED}
      </p>

      <div className="legal-body">
        <p>
          Dengan memakai RoastMyContent (&quot;Layanan&quot;), kamu setuju sama ketentuan di bawah ini.
          Kalau nggak setuju, ya jangan dipakai. Santai aja, tapi ini tetap mengikat secara hukum.
        </p>

        <h2>1. Apa itu Layanan ini</h2>
        <p>
          RoastMyContent adalah hiburan: kamu upload video konten, AI menontonnya lalu bikin
          &quot;roast&quot; (komentar jujur, sarkas, lucu) sebagai karakter pilihanmu. Roast ini{" "}
          <strong>murni hiburan dan pendapat yang dihasilkan AI</strong> — bukan nasihat profesional,
          bukan penilaian faktual, dan nggak boleh dianggap sebagai kebenaran objektif.
        </p>

        <h2>2. Umur minimal</h2>
        <p>
          Layanan ini ditujukan untuk pengguna berusia <strong>13 tahun ke atas</strong>. Kalau kamu
          berusia 13–17 tahun, kamu hanya boleh memakai Layanan dengan izin dan pengawasan orang tua
          atau wali. Dengan memakai Layanan, kamu menyatakan memenuhi syarat umur ini. Kami berhak
          menghentikan akses kalau syarat ini ternyata nggak terpenuhi.
        </p>

        <h2>3. Konten yang kamu upload</h2>
        <p>Dengan upload video, kamu menyatakan dan menjamin bahwa:</p>
        <ul>
          <li>Video itu <strong>milik kamu</strong> atau kamu punya izin/hak penuh untuk memakainya.</li>
          <li>
            Kamu <strong>nggak</strong> akan upload konten yang ilegal, eksplisit/pornografi,
            kekerasan ekstrem, ujaran kebencian (SARA), pelecehan, atau yang melanggar hak/privasi
            orang lain.
          </li>
          <li>Kamu kasih izin ke kami untuk memproses video tersebut demi menghasilkan roast.</li>
        </ul>
        <p>
          Kami memakai filter keamanan otomatis dan berhak menolak/menghentikan pemrosesan konten
          yang melanggar, tanpa pemberitahuan.
        </p>

        <h2>4. Cara video diproses (penting)</h2>
        <p>
          Untuk menghasilkan roast, video kamu dikirim ke penyedia AI pihak ketiga (Google Gemini)
          dan layanan penyimpanan sementara (UploadThing). <strong>Video dihapus segera setelah
          selesai diproses</strong> dan nggak kami simpan permanen. Detail lengkap ada di{" "}
          <Link href="/privacy" style={{ color: "var(--ember)" }}>Kebijakan Privasi</Link>.
        </p>

        <h2>5. Yang nggak boleh dilakukan</h2>
        <ul>
          <li>Nyalahgunakan, nge-spam, atau membanjiri Layanan secara otomatis (bot/script).</li>
          <li>Mengakali rate limit atau mekanisme keamanan.</li>
          <li>Reverse engineering, scraping, atau menyalahgunakan infrastruktur kami.</li>
          <li>Memakai Layanan untuk merugikan, mempermalukan, atau melecehkan orang lain.</li>
        </ul>

        <h2>6. Batasan penggunaan &amp; ketersediaan</h2>
        <p>
          Layanan dibatasi pemakaiannya (rate limit harian per pengguna dan secara keseluruhan).
          Kami bisa mengubah, menjeda, atau menghentikan Layanan kapan saja, dan{" "}
          <strong>nggak menjamin Layanan selalu tersedia tanpa gangguan</strong>.
        </p>

        <h2>7. Tanpa jaminan &amp; batasan tanggung jawab</h2>
        <p>
          Layanan disediakan <strong>&quot;apa adanya&quot; (as is)</strong> tanpa jaminan apa pun.
          Roast adalah opini AI yang bisa nggak akurat, kasar, atau salah — itu bagian dari konsepnya.
          Sejauh diizinkan hukum, kami nggak bertanggung jawab atas kerugian apa pun yang timbul dari
          penggunaan Layanan.
        </p>

        <h2>8. Perubahan ketentuan</h2>
        <p>
          Kami bisa memperbarui ketentuan ini sewaktu-waktu. Versi terbaru selalu ada di halaman ini
          dengan tanggal pembaruan di atas. Lanjut memakai Layanan = setuju dengan versi terbaru.
        </p>

        <h2>9. Hukum yang berlaku</h2>
        <p>Ketentuan ini tunduk pada hukum Republik Indonesia.</p>

        <h2>10. Kontak</h2>
        <p>
          Ada pertanyaan? Pakai tombol <strong>Feedback</strong> di dalam app, atau email{" "}
          <a href="mailto:qorvel.studio@gmail.com" style={{ color: "var(--ember)" }}>
            qorvel.studio@gmail.com
          </a>
          .
        </p>
      </div>
    </main>
  )
}
