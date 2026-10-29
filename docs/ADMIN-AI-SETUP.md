# Setup Admin dan AI RuangNalar

Fitur ini menggunakan Google Gemini API untuk membantu Admin membuat draf materi. PDF diproses di browser untuk mengekstrak teks; file PDF mentah tidak diunggah. Teks hasil ekstraksi dikirim ke endpoint AI setelah Admin login.

## Membuat API key Gemini

1. Buka https://aistudio.google.com/apikey.
2. Masuk dengan akun Google dan buat API key.
3. Simpan key tersebut sebagai rahasia. Jangan mengirimkannya ke chat atau memasukkannya ke repository.

Google menyediakan free tier untuk model dan batas tertentu. Default RuangNalar adalah `gemini-2.5-flash-lite`, tetapi ketersediaan model dan kuota gratis mengikuti akun serta ketentuan Google. Periksa https://ai.google.dev/gemini-api/docs/pricing. Saat kuota habis, tunggu hingga tersedia kembali atau periksa batas penggunaan di Google AI Studio.

## Environment variables di Vercel

Di Vercel, buka project RuangNalar → **Settings → Environment Variables**. Tambahkan variabel berikut untuk **Production** (dan Preview jika ingin menguji preview deployment):

- `ADMIN_PASSWORD`: kata sandi kuat khusus Admin. Jangan gunakan kata sandi akun lain.
- `ADMIN_SESSION_SECRET`: secret acak minimal 32 karakter. Buat secara lokal dengan `openssl rand -base64 48`.
- `GEMINI_API_KEY`: API key dari Google AI Studio. Hanya digunakan server; jangan menaruhnya di `index.html`, variabel `NEXT_PUBLIC_*`, atau repository.
- `GEMINI_MODEL` (opsional): nama model Gemini yang tersedia pada akun. Default kode saat ini `gemini-2.5-flash-lite`.

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
