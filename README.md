# KarhutlaTracker

**Demo:** https://karhutla-tracker.vercel.app

Website transparansi titik panas kebakaran hutan dan lahan (karhutla) di Indonesia. KarhutlaTracker mengolah data satelit terbuka menjadi peta, tren, profil per provinsi, dan cek lokasi yang bisa dipahami masyarakat umum. Data diperbarui otomatis setiap 6 jam.

**Subtema:** Open Government Data (Web In Action, MIA 2026)
**Tim:** KarhutlaOps

## Fitur
- **Beranda:** animasi titik panas 7 hari terakhir di peta Indonesia, angka utama, dan ringkasan harian yang disusun AI.
- **Peta Titik Panas:** sebaran titik panas dengan filter provinsi dan tingkat kepercayaan.
- **Tren:** perbandingan dengan minggu lalu dan tahun lalu, grafik 30/90/365 hari, provinsi dengan kenaikan terbesar, dan tabel 38 provinsi.
- **Profil Daerah:** ringkasan AI per provinsi, kepadatan titik panas per 1.000 km² beserta peringkatnya, peta dan grafik provinsi, serta lembaga yang bertanggung jawab dan kanal pelaporan (112, 113, SP4N-LAPOR!).
- **Cek Sekitar:** titik panas dalam radius 50 km dari lokasi pengguna dan kualitas udara hari ini menurut standar ISPU.
- **Tentang Data:** sumber data, cara kerja satelit, dan cara membaca tingkat kepercayaan.

## Sumber Data
| Data | Sumber |
| --- | --- |
| Titik panas | NASA FIRMS, sensor VIIRS (Suomi NPP, NOAA-20, NOAA-21) |
| Luas wilayah provinsi | Badan Informasi Geospasial, Kepmendagri No. 300.2.2-2430/2025 |
| Batas provinsi | GeoJSON 38 provinsi (denyherianto, CC BY 4.0) dan garis pantai geoBoundaries |
| Kualitas udara (PM2.5) | Open-Meteo Air Quality (CAMS), dihitung ke ISPU sesuai PermenLHK P.14/2020 |
| Pencarian lokasi | Open-Meteo Geocoding |
| Peta dasar | OpenStreetMap |

Satu tanggal hanya memakai satu satelit (Suomi NPP diutamakan) supaya titik yang sama tidak terhitung dua kali.

## Tech Stack
- **Frontend:** Vue 3, Vite, Vue Router, Tailwind CSS v4
- **Peta dan grafik:** Leaflet, Chart.js
- **Pengolahan data:** script Node.js yang dijalankan GitHub Actions setiap 6 jam
- **Ringkasan AI:** Google Gemini (model Flash). Semua angka dihitung sistem, AI hanya menyusun kalimat. Jika AI gagal, dipakai ringkasan templat.
- **Deploy:** Vercel

## Alur Data
1. `scripts/fetch-firms.mjs` mengambil titik panas dari NASA FIRMS, mencocokkannya ke 38 provinsi, dan menyimpan riwayat harian.
2. `scripts/ringkasan-ai.mjs` membuat ringkasan nasional dan ringkasan per provinsi.
3. Workflow `.github/workflows/update-data.yml` menyimpan hasilnya ke `frontend/public/data`, lalu Vercel membangun ulang website.

`scripts/backfill-history.mjs` dipakai sekali untuk mengisi riwayat 400 hari ke belakang (pilihan *backfill* saat menjalankan workflow secara manual).

## Cara Menjalankan
1. Clone repo
   ```bash
   git clone https://github.com/IsmailYanuar/karhutla-ops.git
   cd karhutla-ops
   ```
2. Install dan jalankan frontend (data terbaru sudah ada di repo)
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
3. Buka `http://localhost:5173`

### Memperbarui data sendiri (opsional)
Buat file `.env` di folder utama:
```
FIRMS_MAP_KEY=key_dari_firms.modaps.eosdis.nasa.gov
GEMINI_API_KEY=key_dari_aistudio.google.com
```
Lalu jalankan dari folder utama:
```bash
node scripts/fetch-firms.mjs
node scripts/ringkasan-ai.mjs
```
File `.env` jangan di-commit. Di GitHub, kedua key disimpan di **Settings > Secrets and variables > Actions**.

## Progress
- ✅ Pipeline data otomatis NASA FIRMS lewat GitHub Actions (setiap 6 jam, 3 satelit VIIRS)
- ✅ Riwayat harian 400 hari dan luas resmi provinsi dari BIG
- ✅ Beranda dengan animasi titik panas dan ringkasan AI harian
- ✅ Peta Titik Panas dengan filter provinsi dan tingkat kepercayaan
- ✅ Halaman Tren (perbandingan mingguan dan tahunan, tabel 38 provinsi)
- ✅ Cek Sekitar (titik panas radius 50 km dan kualitas udara ISPU)
- ✅ Unduh data (CSV) dari Peta dan Tren
- ✅ Desain ulang tampilan dan responsif di HP
- ⬜ Profil Daerah dengan ringkasan AI per provinsi

## Tim
- Ismail Yanuar Anwas: Ketua, Developer
- Muhammad Falah Marzuq: Dokumentasi, Developer
- Rizki Faiq Akbar: Riset dan Konten, Developer