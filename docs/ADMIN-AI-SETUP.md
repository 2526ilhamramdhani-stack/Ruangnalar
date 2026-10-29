# Setup Admin dan AI RuangNalar

Fitur ini menambahkan login Admin dengan cookie sesi bertanda tangan dan endpoint server untuk membuat draf materi menggunakan OpenAI. PDF diproses di browser untuk mengekstrak teks; file PDF mentah tidak diunggah. Teks hasil ekstraksi dikirim ke endpoint AI setelah Admin login.

## Environment variables di Vercel

Di Vercel, buka project RuangNalar → **Settings → Environment Variables**. Tambahkan variabel berikut untuk **Production** (dan Preview jika ingin menguji preview deployment):

- `ADMIN_PASSWORD`: kata sandi kuat khusus Admin. Jangan gunakan kata sandi akun lain.
- `ADMIN_SESSION_SECRET`: secret acak minimal 32 karakter. Buat secara lokal dengan `openssl rand -base64 48`.
- `OPENAI_API_KEY`: API key OpenAI untuk server. Jangan pernah menaruhnya di `index.html`, variabel `NEXT_PUBLIC_*`, atau repository.
- `OPENAI_MODEL` (opsional): model yang tersedia di akun API. Default kode saat ini `gpt-4.1-mini`.

Simpan variabel, lalu lakukan **redeploy** agar tersedia pada deployment baru. Jangan kirim nilai rahasia ke chat atau commit ke GitHub.

## Cara menguji

1. Buka website yang sudah ter-deploy dan masuk ke menu **Admin AI Studio**.
2. Masukkan `ADMIN_PASSWORD`.
3. Isi teks materi atau pilih PDF berbasis teks (PDF hasil scan gambar belum didukung OCR).
4. Pilih **Buat draf AI** dan periksa ringkasan serta semua soal, kunci jawaban, dan pembahasan secara manual.

## Batasan saat ini

- Draf dibuat oleh AI tetapi belum disimpan ke database atau dipublikasikan.
- Belum ada manajemen akun Admin multi-user, reset kata sandi, audit log, atau rate limiting khusus per akun. Batasi akses dan pantau pemakaian API.
- Batas teks sumber untuk endpoint adalah 50.000 karakter.
- Jangan masukkan data pribadi/sensitif siswa ke materi sumber.
- Jangan gunakan draf AI untuk penilaian resmi sebelum semua soal dan jawaban diverifikasi guru.
- Endpoint memerlukan deployment Vercel yang mendukung Node.js Functions. Setelah branch digabung, uji endpoint di deployment Preview terlebih dahulu.

## Mengaktifkan database dan publikasi materi

Fitur simpan/terbitkan menggunakan Supabase Postgres. Kode endpoint sudah tersedia, tetapi database belum aktif sampai kamu membuat/menghubungkan proyek Supabase dan mengisi variabel berikut di Vercel:

- `SUPABASE_URL`: Project URL dari Supabase → Project Settings → API.
- `SUPABASE_SERVICE_ROLE_KEY`: secret/service-role key dari Supabase → Project Settings → API Keys. Simpan **hanya** di Vercel server environment; jangan masukkan ke HTML, chat, atau GitHub.

Langkah setup:

1. Buat proyek Supabase baru di https://supabase.com/ jika belum punya.
2. Buka **SQL Editor** pada proyek tersebut.
3. Jalankan seluruh SQL dari file `supabase/migrations/20261029000000_learning_contents.sql` di repository.
4. Tambahkan `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` di Vercel untuk Production (serta Preview bila diperlukan).
5. Redeploy proyek Vercel.
6. Login Admin, buat draf AI, periksa seluruh materi/soal, lalu klik **Simpan & terbitkan materi**.
7. Buka menu **Materi Belajar**. Materi terbitan akan muncul di bagian **Materi dari Admin**.

Endpoint publik hanya mengembalikan materi yang berstatus terbit. Penulisan dibatasi ke sesi Admin yang valid; service-role key tidak dikirim ke browser. Data yang sudah diterbitkan dapat dibaca pengunjung website. Jangan menerbitkan dokumen yang berisi data pribadi/rahasia.

PDF diekstrak di browser menggunakan PDF.js. Jika PDF berupa hasil scan atau foto, teks tidak bisa diambil tanpa OCR; gunakan PDF yang teksnya dapat diseleksi atau tempelkan teks materi secara manual. UI kini menampilkan kesalahan ekstraksi yang lebih spesifik dan mencoba CDN alternatif jika pustaka utama gagal dimuat.
