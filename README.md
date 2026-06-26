# Simulasi 3D PLTS Off-Grid Berbasis Web

## Pendahuluan
Proyek ini adalah sebuah aplikasi simulasi interaktif berbasis web untuk Sistem Pembangkit Listrik Tenaga Surya (PLTS) tipe *Off-Grid*. Aplikasi ini menggabungkan visualisasi 3D yang dinamis dengan perhitungan matematis kelistrikan secara *real-time* untuk memberikan pemahaman komprehensif tentang bagaimana sistem PLTS bekerja dari matahari terbit hingga terbenam.

## Latar Belakang
Penggunaan energi surya (PLTS) semakin meningkat sebagai solusi energi bersih dan terbarukan, terutama di daerah terpencil yang tidak terjangkau jaringan listrik utama (PLN) menggunakan sistem *Off-Grid*. Namun, seringkali masyarakat, siswa, atau bahkan teknisi pemula kesulitan memahami fluktuasi produksi energi, manajemen baterai, dan konsep *thermal derating* (penurunan performa akibat suhu tinggi) karena kurangnya representasi visual yang intuitif.

## Masalah
1. Konsep teoritis kelistrikan PLTS seringkali abstrak dan sulit dipahami hanya melalui teks atau rumus matematika statis.
2. Sulit untuk memvisualisasikan bagaimana perubahan suhu lingkungan dan paparan sinar matahari (iradiasi) berdampak langsung pada penurunan daya (*thermal derating*).
3. Sulit memahami dinamika *State of Charge* (SoC) baterai ketika beban konsumsi rumah (seperti TV, Lampu, Pompa) dinyalakan dan dimatikan seiring berjalannya waktu.

## Solusi
Aplikasi **Simulasi 3D PLTS Off-Grid** ini dibuat untuk memecahkan masalah tersebut dengan menyajikan representasi visual 3D yang diintegrasikan dengan kalkulator energi presisi. Pengguna dapat berinteraksi secara langsung (mengubah jam, suhu, mematikan/menyalakan perangkat listrik) dan langsung melihat dampaknya baik di lingkungan 3D (seperti bayangan matahari) maupun melalui grafik analitik.

## Tech Stack
Proyek ini dibangun menggunakan teknologi web modern:
- **Three.js**: Library WebGL untuk rendering scene 3D, pencahayaan (matahari), dan objek (panel surya, rumah, tiang listrik).
- **Vite**: *Build tool* dan *development server* yang sangat cepat.
- **TypeScript**: Superset dari JavaScript untuk penulisan kode yang lebih aman dan terstruktur.
- **Chart.js**: Digunakan untuk me-render grafik dinamis (Produksi vs Konsumsi & SoC Baterai) secara *real-time*.
- **HTML/CSS Vanilla**: Untuk antarmuka pengguna (UI), *Head-Up Display* (HUD), dan *slider* kontrol tanpa framework tambahan.

## Cara Kerja
1. **Engine Waktu & Cuaca**: Pengguna mengatur waktu (00:00 - 24:00) menggunakan slider. Posisi dan intensitas cahaya matahari (objek `DirectionalLight`) di dunia 3D akan menyesuaikan, menciptakan efek siang dan malam yang realistis.
2. **Kalkulator Energi (EnergyCalculator)**: 
   - Membaca nilai Iradiasi berdasarkan jam (sun factor).
   - Menghitung suhu sel ($T_c$) dan melakukan *thermal derating* ($P_{out}$) berdasarkan *input* suhu lingkungan dari pengguna.
   - Mengkalkulasi total Beban Konsumsi ($P_{load}$) berdasarkan *toggle* perangkat elektronik yang aktif.
   - Mengurangi atau menambah SoC baterai tergantung apakah terjadi surplus energi (produksi > beban) atau defisit energi.
3. **Visual & UI Manager**: Memperbarui grafik Chart.js dan HUD (Head-Up Display) melayang dengan angka aktual (Daya PV, Suhu Sel, Beban, Status) di atas kanvas 3D. Kabel dari panel surya ke tiang listrik dan rumah dilukis menggunakan kurva Bezier dengan partikel animasi yang menyimulasikan aliran listrik.

### Contoh Skenario Input (User Flow)
- **Menggeser Slider Waktu ke Pukul 12:00 (Siang)**: Matahari di kanvas 3D berada tepat di atas. Produksi Daya PV akan mencapai puncaknya (misal: 2000 W). Karena daya yang dihasilkan lebih besar dari beban konsumsi rumah, HUD akan menunjukkan status **CHARGING (Hijau)** dan SoC baterai akan mulai naik.
- **Menaikkan Suhu Lingkungan ke 40°C**: Pengguna menggeser slider suhu cuaca ke kanan. Suhu sel panel ($T_c$) akan otomatis terkalkulasi naik. Daya PV perlahan akan menurun dari 2000 W menjadi misal 1850 W karena efek *thermal derating* (koefisien suhu negatif panel membuang energi akibat panas berlebih).
- **Menyalakan Semua Beban Listrik di Malam Hari**: Pengguna menggeser waktu ke 20:00 (Malam). Matahari tenggelam, produksi PV = 0 W. Pengguna kemudian mencentang (*toggle*) TV, Lampu, dan Pompa Air secara bersamaan, sehingga "Total Beban" melonjak menjadi 800 W. HUD akan menunjukkan status **DISCHARGING (Merah)**, dan grafik SoC baterai akan menukik tajam ke bawah secara *real-time* seiring berjalannya simulasi.

## Cara Jalanin (Instalasi & Menjalankan)

Pastikan Anda sudah menginstal [Node.js](https://nodejs.org/).

1. **Clone/Download** repositori ini ke komputer Anda.
2. Buka terminal di dalam folder proyek.
3. Instal semua dependensi:
   ```bash
   npm install
   ```
4. Jalankan server *development*:
   ```bash
   npm run dev
   ```
5. Buka tautan localhost yang muncul di terminal (biasanya `http://localhost:5173`) di browser Anda.

*Untuk proses build ke production, gunakan:*
```bash
npm run build
```

## Kesimpulan
Aplikasi simulasi ini berhasil mengintegrasikan teori matematis kelistrikan PLTS dengan lingkungan visual interaktif. Pengguna kini memiliki alat *sandbox* untuk bereksperimen dengan cuaca, spesifikasi baterai, dan beban kelistrikan rumah, serta melihat langsung dampaknya terhadap keandalan sistem PLTS *Off-Grid*.

## Saran
Untuk pengembangan selanjutnya, disarankan:
1. Menambahkan variasi cuaca acak (seperti awan mendung secara prosedural) yang tiba-tiba menurunkan iradiasi sesaat.
2. Memperluas database komponen, memungkinkan pengguna memilih tipe panel surya tertentu (Polycrystalline vs Monocrystalline) yang memiliki nilai *Temperature Coefficient* ($\gamma$) berbeda.
3. Menambahkan fitur finansial sederhana untuk menghitung estimasi penghematan atau masa balik modal (ROI) dari sistem yang disimulasikan.
