/* ============================================================
   Bu faylni "config.js" deb nusxa oling va qiymatlarni to'ldiring.
   config.js — Firebase konsolidan olinadigan sozlamalar shu yerda,
   index.html'ni ochib o'tirish shart emas.

   Qadam: Firebase Console → Project settings → General →
          Your apps → Web app (</>) → SDK setup and configuration
   ============================================================ */

window.FIREBASE_CONFIG = {
  apiKey: "",              // ← Firebase konsolidan olinadi
  authDomain: "",
  databaseURL: "",         // ← muhim! Realtime Database URL (....firebasedatabase.app)
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// Ixtiyoriy: shu ro'yxatdagi email'lar "🏫 Maktab nazorati" panelini ko'radi
// (barcha laoshilar va ularning test sonlarini ko'rish uchun). Kerak bo'lmasa bo'sh qoldiring.
window.SUPER_ADMIN_EMAILS = [];   // masalan: ["direktor@maktab.uz"]
