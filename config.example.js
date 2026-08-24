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

// Administrator email/parolini bu yerga yozish shart emas — saytni birinchi marta
// #admin orqali ochganingizda "Administrator hisobini yaratish" ekrani chiqadi,
// va o'sha yerda kiritgan hisobingiz avtomatik administrator bo'ladi.

// Ixtiyoriy: "111111ga majburiy tiklash" tugmasi uchun kerak (parol unutilgan, email
// ishlamaydigan fake hisoblar uchun). Sozlash: README'dagi "Majburiy parol reset (Apps Script)".
// Kerak bo'lmasa bo'sh qoldiring — tugma shunchaki tushuntirib xato beradi, sayt boshqa hamma
// joyda odatdagidek ishlayveradi.
window.APPS_SCRIPT_URL = "";  // masalan: "https://script.google.com/macros/s/AKfycb.../exec"
