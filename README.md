# 考 Laoshi Test — o'rnatish qo'llanmasi

Fayllar: `index.html` (dastur) + `config.js` (sizning Firebase sozlamalaringiz). Server kerak emas —
GitHub Pages + bepul Firebase.

> **Bilib qo'ying:** `config.js` ichidagi qiymatlar (apiKey va h.k.) parol emas — ular Firebase'ning
> ochiq mijoz identifikatorlari, brauzerda kim ko'rsa ham xavfsiz. Haqiqiy himoya pastdagi
> **Database Rules** orqali ta'minlanadi (kim nimani o'qiy/yoza olishini cheklaydi). Qiymatlarni
> alohida faylga chiqarishimizning sababi xavfsizlik emas — toza kod va oson tahrirlash uchun.
> Agar ular repozitoriyda umuman ko'rinmasligini xohlasangiz, pastdagi **"B: Yashirin usul"**ni tanlang.

## 1. Firebase (7 daqiqa, bepul)

1. https://console.firebase.google.com → **Add project** (nom: masalan `laoshi-test`)
2. Chap menyu: **Build → Realtime Database → Create database** → joylashuv tanlang → **Start in test mode**
3. Chap menyu: **Build → Authentication → Get started → Sign-in method → Email/Password** ni yoqing
   *(bu qadam har bir laoshi o'z email+parol bilan ro'yxatdan o'tishi uchun kerak)*
4. ⚙️ **Project settings → General → Your apps → Web (</>)** belgisi → app yarating
5. Chiqqan `firebaseConfig` qiymatlarini keyingi bo'limdagi usullardan biriga joylashtiring
   (`databaseURL` bo'lmasa, Realtime Database sahifasidagi `https://....firebasedatabase.app` manzilini qo'ying)
6. Xohlasangiz, `SUPER_ADMIN_EMAILS` ro'yxatiga o'z email'ingizni qo'shing — shunda sizga qo'shimcha
   **"🏫 Maktab nazorati"** bo'limi ochiladi (barcha laoshilarni va ularning test sonini ko'rish uchun)

### Xavfsizlik qoidalari
Realtime Database → **Rules** bo'limiga quyidagini qo'ying (har bir laoshi faqat o'z testi/natijalarini
yoza va o'qiy oladi, o'quvchilar esa testni ochib javob yozishda davom etaveradi):

```json
{
  "rules": {
    "tests": {
      ".read": true,
      ".indexOn": ["ownerUid"],
      "$testId": {
        ".write": "auth != null && (!data.exists() || data.child('ownerUid').val() === auth.uid)"
      }
    },
    "sessions": {
      "$testId": {
        ".read": "auth != null && root.child('tests').child($testId).child('ownerUid').val() === auth.uid",
        "$sid": { ".write": true }
      }
    },
    "teachers": {
      ".read": "auth != null",
      "$uid": { ".write": "auth != null && auth.uid === $uid" }
    }
  }
}
```

**Nima uchun bunday:** `tests` hamma uchun o'qiladi (o'quvchi havoladagi testni ochishi kerak), lekin
faqat testni yaratgan laoshi (`ownerUid`) uni o'zgartira yoki o'chira oladi. `sessions` (o'quvchi javoblari)
faqat o'sha test egasi laoshiga ko'rinadi. `sessions`ga yozish ochiq qoladi, chunki o'quvchilar tizimga
kirmasdan (anonim) javob yozadi — bu GitHub Pages kabi backend'siz statik sayt uchun qabul qilingan yechim.

## 2. Sozlamalarni joylashtirish — ikki usuldan birini tanlang

### A: Oddiy usul (tavsiya, aksariyat uchun yetarli)

1. `config.example.js` faylidan nusxa oling, nomini `config.js` deb o'zgartiring
2. Ichidagi `window.FIREBASE_CONFIG` va xohlasangiz `window.SUPER_ADMIN_EMAILS` qiymatlarini to'ldiring
3. GitHub'da yangi repository yarating (masalan `laoshi-test`), **Public**
4. `index.html` va `config.js` ikkalasini yuklang (Add file → Upload files) — `.gitignore` faylidagi
   `config.js` qatorini o'chirib tashlang, aks holda `git` orqali push qilganda bu fayl e'tiborga olinmaydi
   (agar web-interfeys orqali "Upload files" bilan yuklasangiz, `.gitignore`ga qaramay baribir yuklanadi)
5. **Settings → Pages → Source: Deploy from a branch → main → / (root)** → Save
6. 1-2 daqiqadan keyin sayt tayyor: `https://USERNAME.github.io/laoshi-test/`

### B: Yashirin usul (config.js git tarixida umuman bo'lmaydi)

Bu usulda `config.js` hech qachon repozitoriyga commit qilinmaydi — GitHub'ning **Secrets** xotirasida
saqlanadi va sayt nashr qilinayotganda avtomatik yaratiladi. Repo `.github/workflows/deploy.yml`
faylini allaqachon o'z ichiga oladi, sizga faqat:

1. GitHub'da repository yarating, `index.html`, `.github/` papkasini yuklang. `config.js` ni **yuklamang**
   (u avtomatik yaratiladi)
2. **Settings → Secrets and variables → Actions → New repository secret** orqali quyidagilarni qo'shing:
   `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_DB_URL`, `FIREBASE_PROJECT_ID`,
   `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MSG_SENDER_ID`, `FIREBASE_APP_ID` (Firebase konsolidagi
   qiymatlar), ixtiyoriy ravishda `SUPER_ADMIN_EMAILS` (masalan `["direktor@maktab.uz"]`)
3. **Settings → Pages → Source: GitHub Actions** ni tanlang (endi "Deploy from a branch" emas)
4. Har safar `main` branch'ga push qilganingizda workflow avtomatik ishga tushib, `config.js`ni
   Secrets'dan yaratadi va saytni nashr qiladi. Repozitoriyning o'zida (kod tarixida) haqiqiy
   qiymatlar hech qachon ko'rinmaydi.

## 3. Bir nechta laoshi

Endi tizim ko'p o'qituvchi uchun mo'ljallangan — parol bitta emas, **har bir laoshi o'zining email +
parol bilan alohida hisob ochadi**:

- Saytga kirib `#admin` (masalan `https://.../laoshi-test/#admin`) ga o'tadi
- **"Ro'yxatdan o'tish"** bo'limida ism, email, parol kiritib hisob yaratadi
- Shundan keyin har safar shu email/parol bilan kiradi
- Har bir laoshi **faqat o'zi yaratgan testlarni va faqat o'z o'quvchilari natijalarini** ko'radi —
  boshqa laoshining testiga aralasha olmaydi
- Parolni unutsa — "Parolni unutdingizmi?" tugmasi orqali emailiga tiklash havolasi yuboriladi
- Agar `SUPER_ADMIN_EMAILS` ga direktor/metodist emaili qo'shilgan bo'lsa, u kirganda qo'shimcha
  **"🏫 Maktab nazorati"** bo'limi ko'rinadi — barcha laoshilar va ularning test sonlari ro'yxati

## 4. Ishlatish

- **Test yaratish formati:**

```
1. «你好» so'zi nima degani?
Rahmat
# Salom
Xayr
----
2. Keyingi savol...
# To'g'ri javob
Boshqa variant
```

- Har savol `----` bilan ajratiladi, to'g'ri javob oldiga `#`
- Baho mezoni: `86 = 5 (A'lo)` ko'rinishida, har qatorda bittadan (foiz = baho)
- Saqlagach o'quvchilarga **doimiy havola** (yoki QR) beriladi
- O'quvchi boshqa oynaga o'tsa → 🔒 bloklanadi → laoshi "✓ Ruxsat" bosgandagina qolgan vaqti bilan davom etadi
