# RuangNalar

RuangNalar adalah platform belajar yang membantu siswa membangun pemahaman melalui alur **Explore → Understand → Practice → Evaluate → Improve**. Produk ini dikembangkan sebagai aplikasi web responsif dengan fokus pada pengalaman belajar yang terstruktur, materi lintas mata pelajaran, latihan, dan evaluasi.

> RuangNalar bukan sekadar tempat mengerjakan soal. RuangNalar adalah tempat siswa membangun pemahaman.

## Status proyek

Repository ini berisi aplikasi web yang sedang dikembangkan. Beberapa fondasi backend sudah tersedia, tetapi belum semua fitur produk siap digunakan sebagai layanan produksi.

| Area | Kondisi implementasi |
|---|---|
| Website pembelajaran | Antarmuka web responsif tersedia |
| Materi dan mata pelajaran | API Supabase untuk membaca materi terbit dan mengelola konten Admin tersedia |
| Admin | Login berbasis password dan sesi cookie bertanda tangan tersedia |
| AI Studio | Endpoint server Gemini untuk membuat draf materi tersedia |
| Handout Pintar | Struktur bagian Handout dan penyimpanan Supabase tersedia setelah migration diterapkan |
| Akun siswa | Skema dasar profil disiapkan; UI autentikasi siswa dan integrasi penuh belum selesai |
| Progres lintas perangkat | Skema database disiapkan; endpoint terautentikasi dan UI belum selesai |
| Simulasi formatif/sumatif | Antarmuka/fitur sisi klien tersedia dalam tahap pengembangan; penilaian server-authoritative belum tersedia |
| Arsip dan Google Drive | Metadata arsip disiapkan; integrasi OAuth Google Drive belum tersedia |

**Penting:** jangan gunakan simulasi yang masih berjalan di sisi klien sebagai sistem penilaian resmi. Sebelum evaluasi dipakai secara serius, alur attempt, timer, pengiriman jawaban, penilaian, dan penyimpanan hasil harus dipindahkan atau diverifikasi di server. Audit keamanan juga masih berlangsung, termasuk penanganan kunci jawaban pada API materi publik.

## Teknologi dan arsitektur

- Frontend: HTML, CSS, dan JavaScript pada aplikasi utama.
- Backend: Vercel Node.js Functions di direktori `api/`.
- Database: Supabase Postgres dengan Row Level Security (RLS).
- Generasi draf AI: Google Gemini melalui endpoint server.
- Deployment: Vercel.
- Build: `build.js`, dengan hasil statis di direktori `dist/`.

Sebagian besar antarmuka saat ini masih terkonsentrasi di `index.html`. Perubahan arsitektur dilakukan bertahap agar fitur yang sudah ada tetap terjaga.

## Menjalankan secara lokal

Persyaratan: Node.js 20 atau lebih baru.

```bash
npm install
npm run build
```

Hasil build berada di `dist/index.html`. Untuk menjalankan fungsi API secara lokal, gunakan lingkungan pengembangan yang kompatibel dengan Vercel Functions dan konfigurasi environment variables yang diperlukan. Build statis saja tidak menyediakan koneksi database atau fungsi server.

## Konfigurasi environment

Atur rahasia berikut di Vercel Project → **Settings → Environment Variables** sesuai environment yang digunakan:

| Variabel | Kegunaan |
|---|---|
| `ADMIN_PASSWORD` | Password khusus untuk login Admin |
| `ADMIN_SESSION_SECRET` | Secret acak minimal 32 karakter untuk menandatangani sesi Admin |
| `GEMINI_API_KEY` | API key Gemini, hanya digunakan di server |
| `GEMINI_MODEL` | Opsional; nama model Gemini yang tersedia pada akun |
| `SUPABASE_URL` | URL project Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key Supabase, hanya di server |

Buat secret sesi secara lokal, misalnya:

```bash
openssl rand -base64 48
```

Jangan pernah memasukkan API key, service-role key, password, atau secret ke frontend, repository, chat, maupun variabel browser yang terekspos seperti `NEXT_PUBLIC_*`. Setelah mengubah environment variables, lakukan redeploy agar fungsi server menggunakan konfigurasi terbaru.

## Database dan migrations

Migration berada di `supabase/migrations/`. Jalankan secara berurutan melalui Supabase SQL Editor atau mekanisme migration yang dikelola project:

1. `20261029000000_learning_contents.sql`
2. `20261029010000_subjects_and_drafts.sql`
3. `20261029020000_learning_content_author.sql`
4. `20261029030000_student_progress_handouts_archive.sql`

Menambahkan file migration ke GitHub **tidak** otomatis menjalankannya di database Supabase. Pastikan project dan environment yang benar dipilih sebelum menjalankan SQL. Tinjau isi migration dan backup database sebelum perubahan skema yang berisiko.

Migration keempat menyiapkan fondasi `student_profiles`, `learning_progress`, `handout_sections`, dan `archive_files`, beserta kebijakan RLS. Keberadaan tabel tidak berarti seluruh alur produk terkait sudah selesai di frontend/backend.

## Admin AI dan pengelolaan materi

Panduan environment, login Admin, Gemini, PDF, Supabase, dan alur publikasi tersedia di [docs/ADMIN-AI-SETUP.md](docs/ADMIN-AI-SETUP.md).

Ringkasnya:
- Admin menggunakan sesi cookie HTTP-only bertanda tangan.
- Gemini dipanggil melalui server; API key tidak dikirim ke browser.
- PDF berbasis teks diekstrak di browser. PDF hasil scan belum didukung OCR.
- DOCX dan PPTX belum didukung sebagai sumber unggahan.
- Hasil AI disimpan sebagai draf untuk diperiksa Admin sebelum diterbitkan.
- Materi terbit dapat dibaca publik. Jangan menerbitkan dokumen yang memuat data pribadi atau informasi rahasia.
- Struktur Handout Pintar memerlukan migration database yang sesuai.

Slug mata pelajaran yang saat ini dikenal API:
- `matematika-wajib`
- `matematika-lanjut`
- `kimia`
- `fisika`
- `fiqih`

## Pengujian dan kualitas

CI GitHub Actions menjalankan pemeriksaan build dan pemeriksaan sumber yang dikonfigurasi di repository. Lulus CI bukan pengganti pengujian browser end-to-end, pengujian integrasi Supabase, atau audit keamanan deployment.

Sebelum perubahan digabung:
1. Jalankan `npm run build`.
2. Jalankan pemeriksaan CI dan tinjau hasilnya.
3. Uji alur terkait pada deployment Preview dengan data uji.
4. Pastikan migration yang dibutuhkan sudah diterapkan di project database pengujian.
5. Jangan menguji operasi destruktif pada data produksi.

## Keamanan dan batasan yang diketahui

- Belum ada rate limiting aplikasi yang memadai untuk seluruh endpoint sensitif; endpoint login Admin dan generasi AI memerlukan perlindungan abuse tambahan.
- Alur autentikasi siswa dan endpoint progres yang memverifikasi identitas siswa belum selesai.
- Penilaian ujian yang otoritatif di server belum tersedia.
- Penanganan kunci jawaban pada respons materi publik sedang menjadi prioritas perbaikan keamanan. Jangan menganggap endpoint latihan publik saat ini aman untuk ujian berisiko tinggi.
- Belum ada audit log Admin multi-user atau alur pemulihan password Admin.
- PDF hasil scan memerlukan OCR yang belum tersedia; DOCX/PPTX belum didukung.
- Integrasi OAuth Google Drive belum tersedia; tabel arsip saat ini hanya menampung metadata/referensi.
- Beberapa operasi penyimpanan konten dan bagian Handout menggunakan beberapa request database, bukan satu transaksi atomik.

Gunakan data uji dan prinsip least privilege. Jangan memasukkan data pribadi/sensitif siswa ke sumber AI. Jangan melakukan deploy produksi, perubahan skema destruktif, atau publikasi materi sensitif tanpa pemeriksaan dan persetujuan pemilik project.

## Kontribusi dan alur pengembangan

- Pertahankan fitur dan data yang sudah ada; hindari rewrite besar tanpa alasan dan rencana migrasi.
- Kerjakan perubahan dalam branch terpisah dan ajukan Pull Request.
- Sertakan ringkasan, risiko, cara uji, dan status verifikasi pada setiap PR.
- Jangan mengklaim fitur, tes, atau integrasi berhasil sebelum benar-benar dijalankan.
- Perubahan database harus kompatibel dan disertai migration serta rencana rollback bila relevan.
