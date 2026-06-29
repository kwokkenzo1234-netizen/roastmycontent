import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Kebijakan Privasi — RoastMyContent",
  description: "Bagaimana RoastMyContent menangani data kamu.",
  alternates: { canonical: "/privacy" },
}

// Tanggal efektif. Update kalau isi kebijakan berubah.
const LAST_UPDATED = "27 Juni 2026"

export default function PrivacyPage() {
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
        KEBIJAKAN PRIVASI
      </h1>
      <p className="label-mono" style={{ color: "var(--smoke)", fontSize: "0.7rem", marginBottom: "28px" }}>
        Terakhir diperbarui: {LAST_UPDATED}
      </p>

      <div className="legal-body">
        <p>
          Kebijakan ini menjelaskan data apa yang kami kumpulkan, untuk apa, dan ke mana data itu
          mengalir. Intinya: kami ambil seminimal mungkin, dan video kamu nggak disimpan permanen.
        </p>

        <h2>1. Data yang kami kumpulkan</h2>
        <ul>
          <li><strong>Video yang kamu upload</strong> — diproses sementara untuk menghasilkan roast.</li>
          <li><strong>Konteks teks opsional</strong> — kalau kamu isi kolom tambahan.</li>
          <li>
            <strong>Alamat IP</strong> — dipakai untuk membatasi penyalahgunaan (rate limit harian)
            saat kamu belum login, bukan untuk identifikasi pribadi.
          </li>
          <li>
            <strong>Data akun (kalau kamu login)</strong> — saat kamu daftar/masuk lewat penyedia
            autentikasi kami (Clerk), kami menerima pengenal akun dan alamat email kamu.
          </li>
          <li>
            <strong>Profil &amp; histori (kalau kamu login)</strong> — niche dan rentang follower
            yang kamu isi saat onboarding, plus histori roast kamu (skor per kategori, badge, dan
            teks roast) supaya kamu bisa melacak progress dari waktu ke waktu.
          </li>
          <li>
            <strong>Feedback</strong> — pesan yang kamu kirim lewat tombol Feedback, plus kontak
            (email/WA) kalau kamu isi secara sukarela.
          </li>
        </ul>
        <p>
          <strong>Login bersifat opsional.</strong> Kamu bisa pakai Layanan tanpa akun — saat itu
          kami tidak menyimpan histori apa pun. Data akun, profil, dan histori di atas hanya kami
          kumpulkan kalau kamu memilih untuk login.
        </p>

        <h2>2. Untuk apa data dipakai</h2>
        <ul>
          <li>Memproses video kamu menjadi roast.</li>
          <li>Mencegah penyalahgunaan dan menjaga biaya layanan tetap wajar (rate limit).</li>
          <li>Mengelola akun dan proses login kamu (kalau kamu memilih login).</li>
          <li>
            Menyimpan histori roast dan menampilkan progress kamu, termasuk perbandingan{" "}
            <strong>anonim</strong> dengan rata-rata kreator lain di niche &amp; rentang follower
            yang sama (tidak menampilkan identitas siapa pun).
          </li>
          <li>Menanggapi dan menindaklanjuti feedback kamu.</li>
        </ul>

        <h2>3. Pihak ketiga yang memproses data</h2>
        <p>Untuk menjalankan Layanan, data tertentu dikirim ke penyedia berikut:</p>
        <ul>
          <li>
            <strong>Google Gemini (AI)</strong> — menerima video kamu untuk dianalisis &amp; di-roast.
            Kami memakai layanan <strong>tier berbayar</strong>, di mana{" "}
            <strong>data kamu TIDAK dipakai untuk melatih model AI Google</strong>. Video dihapus
            dari sisi kami setelah diproses.
          </li>
          <li>
            <strong>UploadThing</strong> — penyimpanan file sementara saat upload. File{" "}
            <strong>dihapus segera setelah</strong> roast selesai diproses.
          </li>
          <li>
            <strong>Clerk</strong> — penyedia autentikasi/login. Mengelola akun dan menyimpan
            kredensial kamu secara aman, hanya kalau kamu memilih untuk login.
          </li>
          <li>
            <strong>Supabase</strong> — basis data kami: menyimpan penghitung rate limit dan isi
            feedback, plus — kalau kamu login — profil (niche &amp; rentang follower) dan histori
            roast kamu.
          </li>
          <li><strong>Vercel</strong> — hosting &amp; pengiriman aplikasi.</li>
        </ul>

        <h2>4. Penyimpanan &amp; retensi</h2>
        <ul>
          <li>
            <strong>Video &amp; konteks:</strong> diproses sementara, lalu{" "}
            <strong>dihapus segera setelah selesai</strong>. Tidak disimpan permanen.
          </li>
          <li>
            <strong>Penghitung rate limit:</strong> disimpan hanya untuk keperluan rate limit harian
            (per IP untuk anonim, per akun untuk yang login) dan di-reset setiap hari.
          </li>
          <li><strong>Feedback:</strong> disimpan sampai kami hapus secara manual.</li>
          <li>
            <strong>Akun, profil &amp; histori roast:</strong> disimpan selama akun kamu aktif supaya
            fitur progress &amp; perbandingan jalan. Kamu bisa minta penghapusan kapan saja (lihat
            bagian Hak kamu).
          </li>
        </ul>

        <h2>5. Hak kamu</h2>
        <p>
          Sesuai hukum perlindungan data yang berlaku di Indonesia (UU PDP), kamu berhak meminta
          informasi, koreksi, atau penghapusan data kamu. Video tidak kami simpan, jadi otomatis
          hilang setelah diproses. Kalau kamu punya akun, kamu bisa minta penghapusan akun beserta
          profil dan histori roast kamu — hubungi kami (lihat bawah).
        </p>

        <h2>6. Anak di bawah umur</h2>
        <p>
          Layanan ini nggak ditujukan untuk anak di bawah 13 tahun. Kalau kamu di bawah umur, pakai
          dengan izin orang tua/wali.
        </p>

        <h2>7. Perubahan kebijakan</h2>
        <p>
          Kebijakan ini bisa diperbarui sewaktu-waktu. Versi terbaru selalu ada di halaman ini dengan
          tanggal pembaruan di atas.
        </p>

        <h2>8. Kontak</h2>
        <p>
          Pertanyaan soal privasi? Pakai tombol <strong>Feedback</strong> di app, atau email{" "}
          <a href="mailto:qorvel.studio@gmail.com" style={{ color: "var(--ember)" }}>
            qorvel.studio@gmail.com
          </a>
          . Lihat juga{" "}
          <Link href="/terms" style={{ color: "var(--ember)" }}>Ketentuan Layanan</Link>.
        </p>
      </div>
    </main>
  )
}
