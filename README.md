# PixPush

Dua game strategi pixel dalam satu aplikasi:

- **PUSH**: geser kubus dari pinggir papan 5×5, bikin 5 warnamu berjajar.
- **WALL**: balapan pion ke seberang papan 9×9 sambil pasang tembok buat halangi lawan.

Bisa lawan komputer (Mudah, Sedang, Sulit), berdua di 1 HP, atau online lewat kode room.

Versi web: https://thommyhermawan.github.io/PixPush/

---

## Isi folder

| File | Gunanya |
|---|---|
| `index.html`, `app.css`, `js/` | Game-nya (dipakai versi web dan aplikasi) |
| `js/config.js` | **Semua ID iklan** dan pengaturan |
| `package.json` | Nama aplikasi, ID aplikasi, ID aplikasi AdMob |
| `privacy.html` | Kebijakan Privasi (wajib buat toko aplikasi) |
| `assets/` | Ikon, splash, gambar buat halaman toko |
| `.github/workflows/android.yml` | Bikin file Android otomatis di GitHub |
| `.github/workflows/ios.yml` | Bikin file iPhone otomatis di GitHub |

---

## Cara ambil file aplikasi Android

1. Buka repo ini di GitHub → tab **Actions** → **Build Android**.
2. Pilih proses yang paling atas yang centangnya hijau.
3. Di bagian **Artifacts**, download:
   - `pixpush-test-apk` → buat dipasang langsung di HP Android (coba-coba).
   - `pixpush-playstore-aab` → buat di-upload ke Google Play Console.

Setiap kali ada perubahan di repo, file baru dibikin otomatis. Mau bikin ulang manual: **Actions → Build Android → Run workflow**.

---

## Rilis ke Google Play

1. Daftar di **play.google.com/console** (bayar sekali, verifikasi identitas).
2. **Create app** → nama `PixPush`, bahasa Indonesia, jenis **Game**, **Free**.
3. Isi bagian **App content**:
   - Privacy policy: `https://thommyhermawan.github.io/PixPush/privacy.html`
   - Ads: **Yes, my app contains ads**
   - Target audience: 13 tahun ke atas
   - Data safety: aplikasi tidak mengumpulkan data pribadi; iklan Google memakai ID perangkat (pilih sesuai panduan AdMob).
4. **Store listing**: pakai `assets/store-icon-512.png` dan `assets/feature-graphic-1024x500.png`, plus screenshot dari HP.
5. **Testing → Closed testing**: upload `.aab`, undang minimal 12 tester (email Gmail), tunggu 14 hari.
6. Setelah itu ajukan **Production**.

**Kunci tanda tangan (wajib sebelum upload pertama):** file `.aab` harus ditandatangani pakai kunci upload milikmu. Kuncinya sudah dikirim ke kamu lewat chat (jangan di-upload ke repo). Masukkan ke GitHub sekali saja:

1. Repo ini → **Settings → Secrets and variables → Actions → New repository secret**.
2. Name `PIX_KEYSTORE_B64` → isi dengan seluruh teks dari file `pixpush-upload-key-base64.txt`.
3. Name `PIX_KEY_PASSWORD` → isi dengan password kunci.
4. **Actions → Build Android → Run workflow**. File `.aab` yang baru sudah bertanda tangan.

Simpan file kunci dan password di tempat aman (misal Google Drive pribadi). Kalau hilang, kamu harus minta reset kunci upload ke Google.

---

## Pasang iklan (AdMob)

1. Daftar di **admob.google.com**.
2. **Apps → Add app** → Android → nama PixPush. Ulangi buat iOS.
3. Bikin 3 **Ad unit** per aplikasi: **Banner**, **Interstitial**, **Rewarded**.
4. Isi ID-nya:
   - `package.json` → `admobAppIdAndroid` dan `admobAppIdIos` (ID yang ada tanda `~`).
   - `js/config.js` → bagian `ADMOB` (ID yang ada tanda `/`).
5. Di `js/config.js` ganti `AD_TEST_MODE: true` jadi `false`.
6. Naikkan `version` di `package.json` (misal `1.0.1`), tunggu build baru, upload ke Play Console.

Penting: **jangan klik iklan sendiri** di aplikasi yang sudah pakai ID asli. AdMob bisa blokir akun.

Iklan yang dipasang:
- **Banner** di menu utama (nggak muncul saat main).
- **Iklan layar penuh** setelah game selesai, paling sering tiap 90 detik.
- **Iklan berhadiah** buat undo kedua dan seterusnya (undo pertama gratis).

---

## Rilis ke App Store (iPhone)

Butuh **Apple Developer Program** (bayar per tahun). Build-nya jalan di server Mac milik GitHub, jadi nggak perlu punya Mac.

1. Daftar di **developer.apple.com/programs**.
2. Di **App Store Connect** → **Apps → +** → bundle ID `com.thommyhermawan.pixpush`, nama PixPush.
3. Bikin **API key**: App Store Connect → Users and Access → Integrations → App Store Connect API → **+** (akses **App Manager**). Download file `.p8`.
4. Simpan di GitHub repo → **Settings → Secrets and variables → Actions**:
   - `APPLE_TEAM_ID` → Team ID (ada di developer.apple.com → Membership)
   - `ASC_KEY_ID` → Key ID
   - `ASC_ISSUER_ID` → Issuer ID
   - `ASC_KEY_P8` → isi file `.p8` (buka pakai Notes, salin semua)
5. **Actions → Build iOS → Run workflow**, centang **Upload to TestFlight**.
6. Setelah muncul di TestFlight, isi halaman toko di App Store Connect dan **Submit for Review**.

---

## Ganti versi

Setiap rilis baru, naikkan `version` di `package.json` (contoh `1.0.0` → `1.0.1`). Nomor build naik otomatis.
