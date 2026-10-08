// ===== PixPush configuration =====
// Semua ID iklan ada di sini. Selama AD_TEST_MODE = true, aplikasi pakai iklan percobaan dari Google
// (aman dipakai saat uji coba, nggak menghasilkan uang). Ganti ke false SETELAH ID asli kamu diisi.
window.PIX_CONFIG = {
  VERSION: "1.0.0",
  WEB_URL: "https://thommyhermawan.github.io/pixpush/",   // link versi web, dipakai buat ajak teman dari aplikasi
  PEER_PREFIX: "pixpush-v1-",
  FREE_UNDOS_PER_GAME: 1,       // undo gratis per game sebelum minta nonton iklan
  AD_EVERY_SECONDS: 90,         // jarak minimum antar iklan layar penuh
  AD_TEST_MODE: true,

  // --- Versi web (Google AdSense, H5 Games Ads) ---
  ADSENSE_CLIENT: "",           // contoh: "ca-pub-1234567890123456"
  AD_SLOT_HOME: "",             // ID unit banner di menu (opsional)

  // --- Aplikasi Android & iPhone (Google AdMob) ---
  // ID aplikasi AdMob (yang pakai tanda ~) diisi di package.json bagian "pixpush".
  ADMOB: {
    android: { banner: "", interstitial: "", rewarded: "" },
    ios:     { banner: "", interstitial: "", rewarded: "" }
  },
  // ID percobaan resmi dari Google, dipakai otomatis saat AD_TEST_MODE = true
  ADMOB_TEST: {
    android: { banner: "ca-app-pub-3940256099942544/9214589741", interstitial: "ca-app-pub-3940256099942544/1033173712", rewarded: "ca-app-pub-3940256099942544/5224354917" },
    ios:     { banner: "ca-app-pub-3940256099942544/2435281174", interstitial: "ca-app-pub-3940256099942544/4411468910", rewarded: "ca-app-pub-3940256099942544/1712485313" }
  }
};
