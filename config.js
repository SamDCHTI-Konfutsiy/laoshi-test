/* ============================================================
   Bu faylni "config.js" deb nusxa oling va qiymatlarni to'ldiring.
   config.js — Firebase konsolidan olinadigan sozlamalar shu yerda,
   index.html'ni ochib o'tirish shart emas.

   Qadam: Firebase Console → Project settings → General →
          Your apps → Web app (</>) → SDK setup and configuration
   ============================================================ */

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyB3O4KUkgADgR45yx-85kmAUH_ANV1xmg0",              // ← Firebase konsolidan olinadi
  authDomain: "laoshi-test-8becd.firebaseapp.com",
  databaseURL: "https://laoshi-test-8becd-default-rtdb.firebaseio.com",         // ← muhim! Realtime Database URL (....firebasedatabase.app)
  projectId: "laoshi-test-8becd",
  storageBucket: "laoshi-test-8becd.firebasestorage.app",
  messagingSenderId: "984827169222",
  appId: "1:984827169222:web:4239f929e6cc78a98e8ac7"
};

// Ixtiyoriy: shu ro'yxatdagi email'lar "🏫 Maktab nazorati" panelini ko'radi
// (barcha laoshilar va ularning test sonlarini ko'rish uchun). Kerak bo'lmasa bo'sh qoldiring.
window.SUPER_ADMIN_EMAILS = ["unar00@mail.ru"];   // masalan: ["direktor@maktab.uz"]

// Ixtiyoriy: "111111ga majburiy tiklash" tugmasi uchun kerak. README'dagi
// "Majburiy parol reset (Apps Script)" bo'limini bajargach, shu yerga Web App URL'ni qo'ying.
window.APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyxLskzMl_V3O-hRsAfqGS5GdtMA8uhCHe_1xTn6Kvq5tTX7erviXs_4iNQ8JD24dKQTA/exec";  // masalan: "https://script.google.com/macros/s/AKfycb.../exec"
