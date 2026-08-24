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
  ro'yxatdan o'zi o'tmaydi — barcha hisoblarni faqat administrator yaratadi). Vaqtinchalik parol
  maydoni standart holda **`111111`** bilan to'ldirilgan keladi (xohlasa admin qo'lda boshqasiga
  o'zgartirishi ham mumkin, lekin odatda shunchaki shu holicha qoldirsa bo'ladi)
- Yaratilgan email+parolni laoshiga o'zi yetkazadi; laoshi keyin panel ichidagi
  **🔑 Parolni almashtirish** tugmasi (yoki "Parolni unutdingizmi?" email-havolasi) orqali
  o'z parolini almashtirishi mumkin
- Agar laoshi paroli **butunlay unutilgan va email ham ishlamaydigan fake hisob** bo'lsa, har bir
  qator yonidagi **"🔁 111111ga tiklash"** tugmasi orqali parolni majburan `111111` ga qaytarish
  mumkin (buning uchun bir martalik qo'shimcha sozlash kerak — pastdagi **"Majburiy parol reset
  (Apps Script)"** bo'limiga qarang)
- Har bir laoshi qatorida **"Cheklash"** tugmasi bor — bosilsa, o'sha laoshi tizimga kira olmay qoladi
  (keyinchalik **"Ruxsat berish"** bilan qaytarish mumkin)
- Administratorning o'zi ham oddiy laoshi kabi test yaratishi va natijalarni ko'rishi mumkin
  (**Testlarim / Yangi test / Jonli natijalar** bo'limlari orqali)

### Laoshi imkoniyatlari

- Faqat **o'zi yaratgan testlarni va faqat o'z o'quvchilari natijalarini** ko'radi
- Cheksiz test yaratishi mumkin
- Panel yuqorisidagi **🔑 Parolni almashtirish** tugmasi orqali, "Parolni unutdingizmi"
  email-havolasiga muhtoj bo'lmasdan, joriy parolini bilgan holda o'zi yangi parol
  o'rnatishi mumkin (masalan, admin bergan `111111` ni birinchi kirishdayoq almashtirish uchun)
- Agar administrator uni cheklasa, keyingi kirishda **"Hisobingiz cheklangan"** xabari chiqadi va
  tizimga kira olmaydi

## 3.5 Majburiy parol reset (Apps Script) — parol unutilgan/fake hisoblar uchun

Oddiy holatda laoshi parolini o'zi almashtiradi (pastga qarang) yoki "Parolni unutdingizmi?"
orqali email havolasi oladi. Lekin admin tomonidan test uchun ochilgan **fake** hisoblarda
email haqiqiy emas — havola hech qayerga bormaydi. Bunday hollarda Firebase (xavfsizlik
sababli) admin panelidan to'g'ridan-to'g'ri "boshqa birovning parolini o'zgartirish"ga
ruxsat bermaydi — buning uchun kichik, **butunlay bepul** yordamchi backend kerak bo'ladi
(Google Apps Script orqali, Firebase to'lov rejasi shart emas).

O'rnatilgach, admin panelida **👥 Laoshilar** bo'limida har bir hisob yonida
**"🔁 111111ga tiklash"** tugmasi ishlay boshlaydi — bosilsa, o'sha hisob paroli darhol
`111111` ga o'zgaradi (boshqa parolni admin tanlay olmaydi — atayin shunday, xavfsizlik
uchun). Sozlamasangiz ham sayt boshqa hamma joyda odatdagidek ishlayveradi, faqat shu bitta
tugma "sozlanmagan" deb xabar beradi.

**1) Xizmat hisobi (service account) yaratish**
1. https://console.cloud.google.com → yuqorida loyihangizni tanlang (Firebase bilan bir xil, masalan `laoshi-test-8becd`)
2. **IAM & Admin → Service Accounts → + Create Service Account** → nom bering (masalan `laoshi-admin-reset`) → Create and continue
3. Rol qo'shing: **Firebase Authentication Admin** va **Firebase Realtime Database Admin** (ikkalasi ham) → Done
4. Yaratilgan hisobni oching → **Keys → Add key → Create new key → JSON** → fayl kompyuteringizga yuklab olinadi (buni hech kimga bermang, faqat keyingi qadamda ishlatiladi)

**2) Google Apps Script loyihasi**
1. https://script.google.com → **New project**
2. Standart `Code.gs` ichidagini o'chirib, repodagi `apps-script/Code.gs` faylining butun matnini joylashtiring
3. Fayl boshidagi uchta qatorni to'ldiring — qiymatlar `config.js` dagilar bilan **bir xil** bo'lishi kerak:
   `FIREBASE_PROJECT_ID`, `FIREBASE_API_KEY`, `FIREBASE_DB_URL`
4. Chap menyu **Project Settings (⚙️) → Script Properties → Add script property**:
   - nomi: `SERVICE_ACCOUNT_JSON`, qiymati: 1-qadamda yuklab olingan JSON faylning **butun matni** (bir butun qator sifatida yopishtiring)
5. **Deploy → New deployment** → ⚙️ dan **Web app** turini tanlang:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - **Deploy** → chiqqan **Web app URL**'ni nusxalab oling (`https://script.google.com/macros/s/.../exec`)
   - (Kod keyinroq o'zgarsa, qayta **Deploy → Manage deployments → ✏️ → New version** qilishni unutmang)

**3) Saytga ulash**
- `config.js` ichidagi `window.APPS_SCRIPT_URL` qatoriga 2-qadamdagi Web app URL'ni qo'ying, saqlang va GitHub'ga qayta yuklang (yoki push qiling)
- Tayyor — endi admin panelida "🔁 111111ga tiklash" tugmasi ishlaydi

## 3.55 Test yaratish va tahrirlash — uch xil yo'l

Savollarni kiritishning uchta yo'li bor va **uchalasi ham bir joyga** — "➕ Yangi test" bo'limidagi
**Savollar** maydoniga tushadi. Ya'ni fayldan yuklasangiz ham, bittalab qo'shsangiz ham, natijani
o'sha maydonda ko'rasiz, tekshirasiz va kerak bo'lsa qo'lda tuzatasiz.

**1) Matn maydoniga yozish (avvalgidek).** Hech narsa o'zgarmadi: har savol `---` bilan ajratiladi,
to'g'ri javob oldiga `#` qo'yiladi. Ilgari shu usulda ishlagan bo'lsangiz, xuddi shunday davom eting.

**2) Fayldan yuklash.** `.txt` yoki `.csv` faylni tanlaysiz.

- `.txt` — matn maydonidagi format bilan bir xil. **⬇ Namuna .txt** tugmasi tayyor namunani beradi.
- `.csv` — Excel yoki Google Sheets'da tayyorlash uchun. Ustunlar: **Savol, A, B, C, D, To'g'ri**.
  Oxirgi ustunga to'g'ri javobning harfi (`A`, `B`, `C`…) yoki raqami (`1`, `2`, `3`…) yoziladi.
  Kerak bo'lmagan variant ustunini bo'sh qoldirasiz — masalan uch variantli savolda `D` bo'sh turadi.
  **⬇ Namuna .csv** tugmasi tayyor jadvalni beradi, uni Excel'da ochib ustidan yozaverasiz.

Vergul yoki qo'shtirnoq ichida bo'lgan matnlar to'g'ri o'qiladi. Nuqta-vergul (`;`) bilan ajratilgan
CSV ham qabul qilinadi — Excel ba'zi tillarda shunday saqlaydi. Biror qator xato bo'lsa, nechanchi
qator ekani va nima yetishmayotgani aytiladi, qolgan to'g'ri qatorlar baribir qo'shiladi.

**3) Bittalab qo'shish.** Savol matnini yozasiz, variantlarni to'ldirasiz, to'g'risining yonidagi
doirachani belgilaysiz va **➕ Savolni qo'shish** bosasiz. Maydonlar tozalanadi va keyingi savolni
yozaverasiz. Oltitagacha variant bo'lishi mumkin, bo'sh qoldirilganlari hisobga olinmaydi.

### ✏️ Testni tahrirlash

Endi yaratilgan testni o'zgartirish mumkin. **📚 Testlarim** ro'yxatida (va administrator uchun
**👥 Laoshilar → 📚 Testlari** ichida) har bir testda **✏️ Tahrirlash** tugmasi bor.

Bosilganda test butun sozlamalari va savollari bilan formaga yuklanadi — nomi, vaqti, urinishlar
soni, aralashtirish, boshlanish/tugash vaqti, baho mezoni va barcha savollar. Xohlaganingizni
o'zgartirib **💾 O'zgarishlarni saqlash** bosasiz. Test havolasi **o'zgarmaydi**, ya'ni
o'quvchilarga tarqatilgan havola ishlayveradi.

Tahrirlashda saqlanib qoladigan narsalar: test egasi, yaratilgan sana, yopiq/ochiq holati, umumiy
testdan olingan nusxa bo'lsa manba haqidagi ma'lumot. Kim va qachon tahrirlagani testga yozib
qo'yiladi va qaydlar jurnaliga ham tushadi — jurnalda aynan nima o'zgargani ko'rinadi (masalan
`nomi: "HSK 2" → "HSK 3" · savollar soni: 10 → 12`).

**Diqqat:** agar testda allaqachon o'quvchi natijalari bo'lsa, tahrirlash oynasida qizil
ogohlantirish chiqadi. Nomi, vaqti, urinishlar sonini o'zgartirish xavfsiz. Lekin savollarni
o'zgartirsangiz yoki tartibini almashtirsangiz, eski natijalar yangi savollarga moslab
ko'rsatiladi — "kim qaysi savolda xato qilgan" degan tahlil noto'g'ri chiqadi. Bunday holatda
eski natijalarni oldin Excel'ga saqlab olgan ma'qul.

Administrator har qanday laoshining testini tahrirlay oladi; laoshi esa faqat o'zinikini.

## 3.6 Qaydlar jurnali va korzinka

### 🧾 Qaydlar (faqat administrator)

Admin panelidagi **🧾 Qaydlar** bo'limida kim, qachon va nima qilgani yozib boriladi — barcha
laoshilar va administratorlar bo'yicha. Har bir qaydda: vaqt, kimning ismi va emaili, amal turi,
qaysi test yoki qaysi o'quvchi ustida bajarilgani.

Yoziladigan amallar: test yaratish/o'chirish/yakunlash/qayta ochish, umumiyga qo'shish va undan
chiqarish, umumiy testdan nusxa olish, o'quvchiga testni qayta ochish, bloklangan o'quvchiga ruxsat
berish, natijani o'chirish, hisob ochish/o'chirish/cheklash, rol o'zgartirish, parol resetlari,
e'lonlar, kirish va chiqish, korzinkadan tiklash va butunlay o'chirish.

Yuqoridagi maydonlar orqali ism/test nomi bo'yicha qidirish, amal turi va davr bo'yicha saralash
mumkin. **⬇ JSON** va **⬇ CSV (Excel)** tugmalari o'sha paytdagi saralangan ro'yxatni yuklab beradi —
JSON arxiv uchun, CSV esa Excel'da ochish uchun qulay.

Laoshilar bu bo'limni umuman ko'rmaydi.

### 🗑 Korzinka

O'chirilgan narsalar darhol yo'q bo'lmaydi — avval korzinkaga tushadi:

| Nima | Kim ko'radi | Tiklanganda |
|---|---|---|
| Test | egasi va administrator | test **va uning barcha natijalari** qaytadi |
| O'quvchi natijasi | test egasi va administrator | o'sha natija o'z testiga qaytadi |
| Hisob (laoshi) | administrator | profil qaytadi, hisob yana kira oladi |
| E'lon | administrator | e'lon ro'yxatga qaytadi |

Yozuvlar **90 kun** saqlanadi, keyin avtomatik o'chadi (panel ochilganda tekshiriladi). Kutmasdan
yo'q qilish uchun har bir qator yonida **"Butunlay o'chirish"** tugmasi bor — u orqaga qaytmaydi.

Bitta muhim cheklov: hisob o'chirilganda uning **Firebase Authentication** yozuvi joyida qoladi
(brauzerdan boshqa birovning auth hisobini o'chirib bo'lmaydi). Ya'ni hisob tizimga kira olmay
qoladi, lekin o'sha email band bo'lib turadi va u bilan yangi hisob ocholmaysiz — kerak bo'lsa
korzinkadan tiklaysiz, yoki Firebase Console → Authentication bo'limidan qo'lda o'chirasiz.

### Admin uchun test boshqaruvi

- **Testlarim** ro'yxatida administrator har qanday testni umumiyga qo'sha oladi yoki
  **🚫 Umumiydan chiqarish** bilan umumiylikdan olib tashlay oladi. Chiqarilganda boshqa laoshilar
  ro'yxatida ko'rinmay qoladi, lekin **avval nusxa olib qo'yganlarning nusxalariga tegilmaydi** —
  nusxa alohida test, u o'z egasida qolaveradi.
- **👥 Laoshilar → 📚 Testlari** ichida administrator har bir testni yakunlashi, qayta ochishi,
  umumiylikka qo'shishi/chiqarishi va korzinkaga o'chirishi mumkin.

### Yangi Database Rules — bularsiz ishlamaydi

`logs` va `trash` uchun qoida qo'shilmasa, bo'limlar "o'qib bo'lmadi" deb xato beradi. Realtime
Database → **Rules** ga quyidagi ikkita blokni qo'shing (mavjud `tests`, `sessions`, `teachers`
bloklaringiz yoniga):

```json
"logs": {
  ".read": "root.child('teachers').child(auth.uid).child('role').val() === 'admin'",
  ".indexOn": ["at"],
  "$logId": {
    ".write": "auth != null && (!data.exists() || root.child('teachers').child(auth.uid).child('role').val() === 'admin')"
  }
},
"trash": {
  ".read": "root.child('teachers').child(auth.uid).child('role').val() === 'admin'",
  "$owner": {
    ".read": "auth != null && auth.uid === $owner",
    ".write": "auth != null && (auth.uid === $owner || root.child('teachers').child(auth.uid).child('role').val() === 'admin')"
  }
}
```

Jurnal **qo'shishga ochiq, o'zgartirishga yopiq**: har kim yangi qayd yoza oladi, lekin yozilganini
tahrirlash yoki o'chirishni faqat administrator qila oladi. Shuning uchun laoshi o'z izini
yashira olmaydi.

Bundan tashqari, administrator boshqa laoshining testini boshqarishi va natijalarini ko'rishi uchun
mavjud `tests` va `sessions` qoidalariga administrator sharti qo'shilishi kerak:

```json
"tests": {
  ".read": true,
  ".indexOn": ["ownerUid", "shared", "sourceTestId"],
  "$testId": {
    ".write": "auth != null && root.child('teachers').child(auth.uid).child('active').val() !== false && (!data.exists() || data.child('ownerUid').val() === auth.uid || root.child('teachers').child(auth.uid).child('role').val() === 'admin')"
  }
},
"sessions": {
  "$testId": {
    ".read": "auth != null && root.child('teachers').child(auth.uid).child('active').val() !== false && (root.child('tests').child($testId).child('ownerUid').val() === auth.uid || root.child('teachers').child(auth.uid).child('role').val() === 'admin')",
    ".write": "auth != null && root.child('teachers').child(auth.uid).child('role').val() === 'admin'",
    "$sid": { ".write": true }
  }
}
```

## 3.7 Kirish tarixi, barcha testlar va tugallanmagan natijalar

### 🔐 Kirishlarim

Har bir laoshi o'z panelida **🔐 Kirishlarim** bo'limini ko'radi: hisobga qachon, qaysi qurilma va
brauzerdan kirilgani, hamda IP manzil. Oxirgi 20 ta kirish ko'rsatiladi, bazada 50 tasi saqlanadi —
undan eskisi avtomatik o'chadi.

Administrator uchun bu ma'lumot **🧾 Qaydlar** jurnalida ham ko'rinadi: "🔑 Tizimga kirdi" qaydining
izohida `Windows 10/11 · Chrome 131 · IP 84.54.x.x` deb turadi.

IP haqida ochiq gapiraylik: brauzer o'z IP'sini bilmaydi, shuning uchun u bepul tashqi xizmatdan
(`api.ipify.org`) so'raladi. Xizmat javob bermasa yoki tarmoq to'sib qo'ysa, IP bo'sh qoladi —
qurilma, brauzer va vaqt baribir yoziladi. Va yodda tuting: IP odatda mobil operator yoki maktab
Wi-Fi'siniki bo'ladi, aniq bir odamni ko'rsatmaydi. Tanish bo'lmagan qurilmani ko'rish ko'proq
foyda beradi.

### 📋 Barcha testlar (faqat administrator)

Tizimdagi hamma test bitta ro'yxatda: kim yaratgani, savollar soni, vaqti, ochiq/yopiq/umumiy
holati, yaratilgan sanasi va tahrirlangan bo'lsa kim tahrirlagani. Laoshi bo'yicha, holat bo'yicha
filtr va nom/ism bo'yicha qidiruv bor.

**📊 Natijalar sonini hisoblash** tugmasi har bir testga nechta o'quvchi kirganini qo'shib beradi.
U alohida tugma qilingan, chunki bu barcha natijalarni yuklab ko'rishni talab qiladi — ro'yxat
o'zi tez ochilsin uchun avtomatik bajarilmaydi.

Har bir test yonidagi **⋯** menyusida: tahrirlash, yakunlash/qayta ochish, umumiylik, havolani
nusxalash va korzinkaga o'chirish.

### Tugallanmagan natijalar endi ko'rinadi

Ilgari o'quvchi testni tugatmasa **📊 Jonli natijalar** dagi "Natija" ustunida `—` turardi.
Endi u shu paytgacha to'plagan bali bilan ko'rinadi:

```
12/40 · 30% · 2 (Qoniqarsiz)
tugallanmagan · 20 ta javob
```

Ya'ni o'quvchi 40 savoldan 20 tasini ishlab, keyin bloklangan yoki chiqib ketgan bo'lsa ham,
laoshi uning holatini ko'radi. Baho ham hisoblanadi — to'g'ri javoblar **butun test** savollariga
nisbatan olinadi, javob berilganlarga emas.

Excel eksportiga ham shu qo'shildi: yangi **"Javob berdi"** ustuni va holat ustunida
`(tugallanmagan)` belgisi.

### Yangi Database Rules bloki

`logins` uchun qoida qo'shilmasa, **🔐 Kirishlarim** bo'limi xato beradi. Rules'ga qo'shing:

```json
"logins": {
  ".read": "auth != null && root.child('teachers').child(auth.uid).child('role').val() === 'admin'",
  "$uid": {
    ".read": "auth != null && (auth.uid === $uid || root.child('teachers').child(auth.uid).child('role').val() === 'admin')",
    "$id": {
      ".write": "auth != null && (auth.uid === $uid || root.child('teachers').child(auth.uid).child('role').val() === 'admin')"
    }
  }
}
```

Ya'ni laoshi faqat o'z kirish tarixini o'qiydi va faqat o'ziga yozadi; administrator hammasini
ko'radi.

## 3.8 Panel ko'rinishi

Panel qayta ishlandi:

- Sarlavha yuqorida **yopishqoq** — pastga aylantirsangiz ham ism, "Parolni almashtirish" va
  "Chiqish" ko'rinib turadi
- Bo'limlar ko'paygani uchun tab qatori mobilda **yonga siljiydi**
- Ro'yxat qatorlari (laoshilar, testlar, korzinka) bir xil ko'rinishga keltirildi: chapda nom va
  belgilar, o'ngda amallar
- Har qatorda faqat eng kerakli 1–2 tugma qoladi, qolgani **⋯** menyusiga yig'ildi — ilgari bir
  qatorda oltita tugma yonma-yon turardi
- Jadvallar aylantirilganda sarlavha qatori joyida turadi
- Sanalar `24.08.2026 · 14:32` ko'rinishida yoziladi (avval brauzer `2026 M08 24` deb chiqarardi)
- Mobilda tugmalar butun kenglikni egallaydi, kartochkalar ixchamlashdi

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
