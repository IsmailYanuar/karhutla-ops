**Demo:** https://karhutla-tracker.vercel.app

# KarhutlaTracker

Dashboard transparansi data titik panas kebakaran hutan dan lahan (karhutla) di Indonesia. KarhutlaTracker mengolah data publik dari satelit menjadi peta dan statistik yang mudah dipahami masyarakat.

**Subtema:** Open Government Data (Web In Action, MIA 2026)

## Tech Stack
- **Frontend:** Vue 3, Vite, Vue Router, Tailwind CSS
- **Peta & grafik:** Leaflet, Chart.js
- **Pengolahan data:** Script Node.js (direncanakan berjalan otomatis lewat GitHub Actions)
- **Sumber data:** NASA FIRMS, SiPongi KLHK
- **Deploy:** Vercel

## Cara Menjalankan
1. Clone repo
   ```bash
   git clone https://github.com/IsmailYanuar/karhutla-ops.git
   cd karhutla-ops
   ```
2. Buat data contoh titik panas
   ```bash
   node scripts/generate-sample.mjs
   ```
3. Install dan jalankan frontend
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
4. Buka `http://localhost:5173`

## Progress Saat Ini
- [x] Landing page (ringkasan angka, provinsi dengan titik panas terbanyak, alur data)
- [x] Halaman Peta Titik Panas (filter provinsi dan tingkat kepercayaan)
- [x] Halaman Tentang Data (sumber dan cara membaca data)
- [ ] Integrasi data asli NASA FIRMS (saat ini masih memakai data contoh)
- [ ] Pipeline data otomatis dengan GitHub Actions
- [ ] Halaman Tren (grafik)
- [ ] Halaman Profil Daerah

## Tim
- Ismail Yanuar Anwas: Ketua, Developer
- Muhammad Falah Marzuq: Dokumentasi, Developer
- Rizki Faiq Akbar: Riset dan Konten, Developer
