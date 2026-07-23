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
   *(bu qadam laoshi/admin hisoblari email+parol bilan kirishi uchun kerak)*
4. ⚙️ **Project settings → General → Your apps → Web (</>)** belgisi → app yarating
5. Chiqqan `firebaseConfig` qiymatlarini keyingi bo'limdagi usullardan biriga joylashtiring
   (`databaseURL` bo'lmasa, Realtime Database sahifasidagi `https://....firebasedatabase.app` manzilini qo'ying)

### Xavfsizlik qoidalari
Realtime Database → **Rules** bo'limiga quyidagini qo'ying:

```json
{
  "rules": {
    "tests": {
      ".read": true,
      ".indexOn": ["ownerUid"],
      "$testId": {
        ".write": "auth != null && root.child('teachers').child(auth.uid).child('active').val() !== false && (!data.exists() || data.child('ownerUid').val() === auth.uid)"
      }
    },
    "sessions": {
      "$testId": {
        ".read": "auth != null && root.child('teachers').child(auth.uid).child('active').val() !== false && root.child('tests').child($testId).child('ownerUid').val() === auth.uid",
        "$sid": { ".write": true }
      }
    },
    "teachers": {
      ".read": "auth != null",
      "$uid": {
        ".write": "auth != null && ( auth.uid === $uid || root.child('teachers').child(auth.uid).child('role').val() === 'admin' || !root.child('teachers').exists() )"
      }
    }
  }
}
```

**Nima uchun bunday:**
- `tests` hamma uchun o'qiladi (o'quvchi havoladagi testni ochishi kerak), lekin faqat testni yaratgan
  laoshi (`ownerUid`) uni o'zgartira/o'chira oladi — va faqat hisobi **cheklanmagan** bo'lsa.
- `sessions` (o'quvchi javoblari) faqat o'sha test egasi laoshiga ko'rinadi. Yozish ochiq qoladi, chunki
  o'quvchilar tizimga kirmasdan (anonim) javob yozadi — bu backend'siz statik sayt uchun qabul qilingan yechim.
- `teachers/$uid` yozish uchun uchta holat ruxsat beradi: **(a)** odam o'zining profilini yozayotgan bo'lsa
  (birinchi bootstrap uchun), **(b)** yozayotgan kishi allaqachon **administrator** bo'lsa (yangi laoshi
  qo'shish yoki cheklash uchun), **(c)** tizimda hali umuman hech kim yo'q bo'lsa (eng birinchi marta
  ishga tushirish). (c) holati faqat bitta marta — birinchi hisob yaratilgunga qadar — amal qiladi.

## 2. Sozlamalarni joylashtirish — ikki usuldan birini tanlang

### A: Oddiy usul (tavsiya, aksariyat uchun yetarli)

1. `config.example.js` faylidan nusxa oling, nomini `config.js` deb o'zgartiring
2. Ichidagi `window.FIREBASE_CONFIG` qiymatlarini to'ldiring
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
   `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MSG_SENDER_ID`, `FIREBASE_APP_ID` (Firebase konsolidagi qiymatlar)
3. **Settings → Pages → Source: GitHub Actions** ni tanlang (endi "Deploy from a branch" emas)
4. Har safar `main` branch'ga push qilganingizda workflow avtomatik ishga tushib, `config.js`ni
   Secrets'dan yaratadi va saytni nashr qiladi. Repozitoriyning o'zida (kod tarixida) haqiqiy
   qiymatlar hech qachon ko'rinmaydi.

## 3. Rollar: Administrator va Laoshi

Tizimda ikkita boshqaruv roli bor. **O'zi ro'yxatdan o'tish yo'q** — hisoblar faqat administrator
tomonidan ochiladi.

### Birinchi ishga tushirish (faqat bir marta)

1. Saytni oching → `#admin` ga o'ting (masalan `https://.../laoshi-test/#admin`)
2. Tizimda hali hech kim yo'qligi sababli **"Administrator hisobini yaratish"** ekrani chiqadi
3. Ism, email, parol kiritib hisob oching — bu hisob avtomatik **administrator** bo'ladi
4. Shu daqiqadan boshlab bu ekran boshqa hech qachon chiqmaydi — endi faqat **"Kirish"** ekrani ko'rinadi

Shuning uchun bu qadamni ishonchli odamning o'zi, birinchi bo'lib bajarishi kerak.

### Administrator imkoniyatlari

- **👥 Laoshilar** bo'limida yangi laoshiga ism/email/vaqtinchalik parol kiritib hisob ochadi (laoshi
  ro'yxatdan o'zi o'tmaydi — barcha hisoblarni faqat administrator yaratadi)
- Yaratilgan email+parolni laoshiga o'zi yetkazadi; laoshi keyin **"Parolni unutdingizmi?"** orqali
  o'z parolini almashtirishi mumkin
- Har bir laoshi qatorida **"Cheklash"** tugmasi bor — bosilsa, o'sha laoshi tizimga kira olmay qoladi
  (keyinchalik **"Ruxsat berish"** bilan qaytarish mumkin)
- Administratorning o'zi ham oddiy laoshi kabi test yaratishi va natijalarni ko'rishi mumkin
  (**Testlarim / Yangi test / Jonli natijalar** bo'limlari orqali)

### Laoshi imkoniyatlari

- Faqat **o'zi yaratgan testlarni va faqat o'z o'quvchilari natijalarini** ko'radi
- Cheksiz test yaratishi mumkin
- Agar administrator uni cheklasa, keyingi kirishda **"Hisobingiz cheklangan"** xabari chiqadi va
  tizimga kira olmaydi

## 4. Ishlatish

### Test yaratish formati

```
1. «你好» so'zi nima degani?
A. Rahmat
#B. Salom
C. Xayr
D. Kechirasiz
---
2. Keyingi savol...
#A. To'g'ri javob
B. Boshqa variant
```

- Har savol `---` (kamida 3 ta chiziqcha) bilan ajratiladi
- Variantlar oldiga `A.`, `B.` kabi harf qo'yish **ixtiyoriy** — qo'ysangiz ham, qo'ymasangiz ham
  ishlaydi; sayt o'quvchiga har doim o'zi izchil A/B/C/D harflarini ko'rsatadi
- To'g'ri javob oldiga `#` (harfdan oldin ham, harfsiz ham bo'lishi mumkin: `#B.` yoki shunchaki `#`)
- Baho mezoni: `86 = 5 (A'lo)` ko'rinishida, har qatorda bittadan (foiz = baho)

### Test sozlamalari (test yaratishda)

- **Vaqt** — necha daqiqa beriladi
- **Urinishlar soni** — o'quvchi nechta marta o'zi qayta urinib ko'rishi mumkin (standart: 1). Agar
  1 dan ko'p bo'lsa, natija ekranida "🔄 Qayta urinib ko'rish" tugmasi chiqadi — bunda laoshi ruxsati
  shart emas. Chegaradan oshgach yoki tabdan chiqib bloklanganda esa har doim laoshi ruxsati kerak
- **Boshlanish / tugash vaqti** *(ixtiyoriy)* — belgilansa, shu oraliqdan tashqarida o'quvchi havolani
  ochsa ham testni boshlay olmaydi ("hali boshlanmagan" / "vaqti tugagan" xabari ko'rinadi)
- **Baho mezoni** va **xatoni ko'rsatish** avvalgidek laoshi tomonidan belgilanadi

### O'quvchi tomoni

- Saqlagach o'quvchilarga **doimiy havola** (yoki QR) beriladi
- Javoblar har bosishda avtomatik saqlanadi (auto-save)
- Sahifani yopish/yangilashga urinsa — brauzer "Chiqishni tasdiqlaysizmi?" ogohlantirishini chiqaradi
- Boshqa oynaga/ilovaga o'tsa → 🔒 bloklanadi → laoshi **"✓ Ruxsat"** bosgandagina qolgan vaqti bilan
  davom etadi
