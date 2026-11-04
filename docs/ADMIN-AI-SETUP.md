# Setup Admin dan AI RuangNalar

Fitur ini menggunakan Google Gemini API untuk membantu Admin membuat draf materi. PDF diproses di browser untuk mengekstrak teks; file PDF mentah tidak diunggah. Teks hasil ekstraksi dikirim ke endpoint AI setelah Admin login.

## Membuat API key Gemini

1. Buka https://aistudio.google.com/apikey.
2. Masuk dengan akun Google dan buat API key.
3. Simpan key tersebut sebagai rahasia. Jangan mengirimkannya ke chat atau memasukkannya ke repository.

Google menyediakan free tier untuk model dan batas tertentu. Default RuangNalar adalah `gemini-3.5-flash-lite`, tetapi ketersediaan model dan kuota gratis mengikuti akun serta ketentuan Google. Periksa https://ai.google.dev/gemini-api/docs/pricing. Saat kuota habis, tunggu hingga tersedia kembali atau periksa batas penggunaan di Google AI Studio.

## Environment variables di Vercel

Di Vercel, buka project RuangNalar → **Settings → Environment Variables**. Tambahkan variabel berikut untuk **Production** (dan Preview jika ingin menguji preview deployment):

- `ADMIN_PASSWORD`: kata sandi kuat khusus Admin. Jangan gunakan kata sandi akun lain.
- `ADMIN_SESSION_SECRET`: secret acak minimal 32 karakter. Buat secara lokal dengan `openssl rand -base64 48`.
- `GEMINI_API_KEY`: API key dari Google AI Studio. Hanya digunakan server; jangan menaruhnya di `index.html`, variabel `NEXT_PUBLIC_*`, atau repository.
- `GEMINI_MODEL` (opsional): nama model Gemini yang tersedia pada akun. Default kode saat ini `gemini-3.5-flash-lite`.

Simpan variabel, lalu lakukan **redeploy** agar tersedia pada deployment baru. Setelah migrasi, `OPENAI_API_KEY` dan `OPENAI_MODEL` tidak lagi diperlukan oleh endpoint ini; kamu boleh menghapusnya dari Vercel setelah memastikan versi baru berjalan.

## Cara menguji

1. Buka website yang sudah ter-deploy dan masuk ke menu **Admin AI Studio**.
2. Masukkan `ADMIN_PASSWORD`.
3. Isi teks materi atau pilih PDF berbasis teks (PDF hasil scan gambar belum didukung OCR).
4. Pilih **Buat draf AI** dan periksa ringkasan serta semua soal, kunci jawaban, dan pembahasan secara manual.
5. Jika berhasil, klik **Simpan & terbitkan materi** untuk menyimpan materi ke Supabase.

## Batasan saat ini

- Draf dibuat oleh AI dan harus diperiksa Admin sebelum diterbitkan.
- Kuota dan batas permintaan Gemini gratis dapat berubah dan bisa habis; respons 429 berarti kuota/batas sedang tercapai.
- Belum ada manajemen akun Admin multi-user, reset kata sandi, audit log, atau rate limiting khusus per akun. Batasi akses dan pantau pemakaian API.
- Batas teks sumber untuk endpoint adalah 50.000 karakter.
- Jangan masukkan data pribadi/sensitif siswa ke materi sumber.
- Jangan gunakan draf AI untuk penilaian resmi sebelum semua soal dan jawaban diverifikasi guru.
- Endpoint memerlukan deployment Vercel yang mendukung Node.js Functions. Setelah branch digabung, uji endpoint di deployment Preview terlebih dahulu.

## Mengaktifkan database dan publikasi materi

Fitur simpan/terbitkan menggunakan Supabase Postgres. Database harus sudah dibuat dan dihubungkan melalui variabel berikut di Vercel:

- `SUPABASE_URL`: Project URL dari Supabase → Project Settings → API.
- `SUPABASE_SERVICE_ROLE_KEY`: secret/service-role key dari Supabase → Project Settings → API Keys. Simpan **hanya** di Vercel server environment; jangan masukkan ke HTML, chat, atau GitHub.

Langkah setup:

1. Buka **SQL Editor** pada proyek Supabase.
2. Jalankan seluruh SQL dari file `supabase/migrations/20261029000000_learning_contents.sql` di repository jika belum dilakukan.
3. Pastikan `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` tersedia di Vercel untuk Production (serta Preview bila diperlukan).
4. Redeploy proyek Vercel.
5. Login Admin, buat draf AI, periksa seluruh materi/soal, lalu klik **Simpan & terbitkan materi**.
6. Buka menu **Materi Belajar**. Materi terbitan akan muncul di bagian **Materi dari Admin**.

Endpoint publik hanya mengembalikan materi yang berstatus terbit. Penulisan dibatasi ke sesi Admin yang valid; service-role key tidak dikirim ke browser. Data yang sudah diterbitkan dapat dibaca pengunjung website. Jangan menerbitkan dokumen yang berisi data pribadi/rahasia.

PDF diekstrak di browser menggunakan PDF.js. Jika PDF berupa hasil scan atau foto, teks tidak bisa diambil tanpa OCR; gunakan PDF yang teksnya dapat diseleksi atau tempelkan teks materi secara manual. UI kini menampilkan kesalahan ekstraksi yang lebih spesifik dan mencoba CDN alternatif jika pustaka utama gagal dimuat.


## Pengelompokan mata pelajaran dan status draf

Migration tambahan `supabase/migrations/20261029010000_subjects_and_drafts.sql` menambahkan `subject_id` dan `status` secara kompatibel ke tabel `learning_contents`. Jalankan file SQL tersebut di Supabase SQL Editor **sebelum** menggunakan versi aplikasi yang memakai filter mata pelajaran dan penyimpanan draf. Jalankan juga migration `20261029020000_learning_content_author.sql` agar kolom `author_name` tersedia karena API membacanya.

Slug mata pelajaran yang digunakan:
- `matematika-wajib`
- `matematika-lanjut`
- `kimia`
- `fisika`
- `fiqih`

Materi publik hanya diambil jika `published = true` dan `status = 'published'`. Draf admin disimpan dengan status `draft` dan tidak akan tampil pada daftar materi siswa. API tetap mensyaratkan sesi Admin untuk menyimpan atau memperbarui konten.


## Fondasi akun siswa, progres, Handout Pintar, dan arsip

Migration tambahan `supabase/migrations/20261029030000_student_progress_handouts_archive.sql` menyiapkan tabel:
- `student_profiles`: profil dasar yang terhubung ke identitas Supabase Auth.
- `learning_progress`: progres belajar per akun, mata pelajaran, jenis aktivitas, dan kunci progres.
- `handout_sections`: bagian Handout terstruktur untuk overview, mind map, contoh nyata, slide, cheatsheet, modul latihan, dan sumber.
- `archive_files`: metadata arsip, termasuk referensi file Google Drive yang dipilih.

Migration ini juga menambahkan metadata sumber dan peninjauan admin ke `learning_contents`. Jalankan setelah tiga migration sebelumnya di Supabase SQL Editor. Menambahkan file migration ke GitHub **tidak** menjalankannya di proyek Supabase secara otomatis.

### Status implementasi dan batasan

- Skema dan kebijakan Row Level Security untuk progres siswa disiapkan, dengan akses berbasis `auth.uid()`.
- Kebijakan ini belum berarti login siswa sudah tersedia di antarmuka. Alur login/registrasi Supabase Auth dan endpoint progres yang memverifikasi bearer token masih harus diimplementasikan sebelum fitur progres lintas perangkat dipakai.
- Bagian Handout dan metadata arsip belum memiliki endpoint tulis khusus; penulisan sengaja belum dibuka langsung dari browser.
- Google Drive belum terhubung melalui OAuth. Tabel arsip hanya menyimpan metadata/referensi file, bukan token OAuth.
- API konten lama masih menggunakan sesi cookie Admin untuk menulis dan endpoint materi publik masih dapat dibaca tanpa login. Perubahan ke akses siswa wajib login harus dilakukan bersama alur autentikasi siswa dan pengujian agar tidak mengunci admin atau merusak materi yang sudah diterbitkan.
- Untuk kebijakan privasi, jangan menyimpan token Google Drive, service-role key, atau rahasia lain pada kolom metadata maupun frontend.


## Kontrak permanen Handout Pintar untuk setiap unggahan

Setiap kali Admin menjalankan **Buat draf AI** dari file/teks sumber, backend api/generate-content.js memakai kontrak generasi yang sama. Ketentuan ini bukan instruksi opsional untuk Admin.

Bagian wajib yang dihasilkan:
1. Overview, tujuan belajar, prasyarat, dan peta topik.
2. Mind map dengan cabang konsep dan alternatif teks.
3. Contoh penerapan nyata.
4. Minimal lima slide materi yang menjelaskan tujuan, uraian, contoh, saran visual, miskonsepsi, dan cek pemahaman.
5. Cheatsheet konsep/rumus sesuai mata pelajaran dan kondisi penggunaannya.
6. Mnemonik atau strategi mengingat yang relevan.
7. Penutup motivasional; kutipan atau ungkapan tidak boleh diberi atribusi palsu.
8. Macam-macam tipe soal dan strategi penyelesaian.
9. Ide serta variasi konsep soal.
10. Sumber utama, referensi pendukung yang benar-benar tersedia, dan catatan keterbatasan.
11. Dua modul latihan awal, masing-masing tepat 10 soal (20 soal total). Setiap soal memakai opsi A–E, kunci, pembahasan, konsep, tingkat kesulitan, dan catatan sumber.

Backend memvalidasi struktur utama, minimal lima slide, dua modul, jumlah soal, dan lima opsi sebelum mengembalikan draf. Draf yang gagal validasi tidak boleh disimpan atau diterbitkan lewat alur normal. Validasi bentuk bukan jaminan bahwa seluruh fakta atau jawaban benar; Admin tetap harus memeriksa rumus, referensi, kunci, pembahasan, dan kesesuaian materi sebelum publikasi.

Struktur bagian disimpan di tabel handout_sections sebagai data terstruktur. API konten mengupayakan penyimpanan bagian terlebih dahulu sebagai draf, dan baru mengubah status menjadi published setelah penyimpanan bagian berhasil. Pastikan migration 20261029030000_student_progress_handouts_archive.sql sudah diterapkan di Supabase sebelum menggunakan penyimpanan Handout terstruktur.

### Batasan yang perlu diketahui

- Antarmuka unggah saat ini menerima PDF. DOCX dan PPTX belum boleh dianggap didukung sampai ekstraksi dan validasinya benar-benar diimplementasikan.
- PDF berbasis teks dapat diekstrak; PDF hasil scan membutuhkan OCR yang belum tersedia.
- Referensi internet hanya boleh diisi jika pencarian/sumbernya benar-benar tersedia. Generator tidak boleh mengarang URL atau menyatakan sudah browsing tanpa bukti.
- Penyimpanan bagian Handout membutuhkan Supabase dan migration yang sesuai. File migration di repository tidak otomatis diterapkan ke database.
