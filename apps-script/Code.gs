/**
 * Laoshi Test — "111111ga majburiy parol reset" backend'i (Google Apps Script)
 * ==============================================================================
 * Bu skript FAQAT bitta ishni bajaradi: administrator tanlagan laoshi/admin
 * hisobining Firebase Authentication parolini "111111" ga majburan o'zgartiradi
 * — hatto o'sha hisobning joriy parolini hech kim bilmasa ham (masalan, email
 * ishlamaydigan fake test hisoblari uchun).
 *
 * XAVFSIZLIK: chaqiruvchi client "men adminman" desa ham, bu skript unga
 * ishonmaydi. Har bir so'rovda:
 *   1) kelgan Firebase idToken haqiqatan ham amaldagi foydalanuvchiga tegishli
 *      ekanligi Google tomonida tekshiriladi,
 *   2) o'sha foydalanuvchining "teachers/{uid}/role" qiymati serverning o'z
 *      (service-account) huquqi bilan bazadan o'qib, chindan ham "admin" ekani
 *      va "active" (cheklanmagan) ekani tasdiqlanadi.
 * Faqat shundan keyingina parol o'zgartiriladi. Shu tufayli config.js/index.html
 * ichida hech qanday maxfiy kalit saqlash shart emas — bularning barchasi shu
 * yerda, Script Properties'da qoladi.
 *
 * O'RNATISH — README.md dagi "Majburiy parol reset (Apps Script)" bo'limiga qarang.
 */

// ====== SHU IKKI QATORNI config.js dagi qiymatlar bilan bir xil qiling ======
const FIREBASE_PROJECT_ID = 'PROJECT_ID_BU_YERGA';   // config.js -> FIREBASE_CONFIG.projectId
const FIREBASE_API_KEY    = 'API_KEY_BU_YERGA';      // config.js -> FIREBASE_CONFIG.apiKey
const FIREBASE_DB_URL     = 'DATABASE_URL_BU_YERGA'; // config.js -> FIREBASE_CONFIG.databaseURL (oxirida / bo'lmasin)
const DEFAULT_PASSWORD    = '111111';
// ==============================================================================

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const idToken = body.idToken;
    const targetUid = body.targetUid;
    if (!idToken || !targetUid) return json_({ ok: false, error: "idToken va targetUid kerak" });

    // 1) idToken haqiqatan ham amaldagi Firebase foydalanuvchisiga tegishli ekanini tekshirish
    const lookup = callIdentityToolkitPublic_('accounts:lookup', { idToken: idToken });
    if (!lookup.users || !lookup.users.length) {
      return json_({ ok: false, error: "Token yaroqsiz yoki muddati o'tgan. Sahifani yangilab qayta urinib ko'ring." });
    }
    const callerUid = lookup.users[0].localId;

    // 2) service-account (admin) huquqi bilan bazadan chaqiruvchining haqiqiy rolini o'qish
    const accessToken = getServiceAccountToken_();
    const callerProfile = dbGet_(accessToken, 'teachers/' + callerUid);
    if (!callerProfile || callerProfile.role !== 'admin' || callerProfile.active === false) {
      return json_({ ok: false, error: "Faqat administrator (va faqat cheklanmagan bo'lsa) parolni tiklay oladi." });
    }

    // 3) nishon hisob chindan ham mavjudligini tekshirish
    const targetProfile = dbGet_(accessToken, 'teachers/' + targetUid);
    if (!targetProfile) return json_({ ok: false, error: "Bunday hisob bazada topilmadi." });

    // 4) parolni admin huquqi bilan majburan "111111" ga o'zgartirish
    callIdentityToolkitAdmin_(accessToken, targetUid, DEFAULT_PASSWORD);

    return json_({ ok: true, email: targetProfile.email });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

/* ---------- yordamchi funksiyalar ---------- */

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Ochiq (API key bilan) Identity Toolkit chaqiruvi — faqat tokenni tekshirish uchun, hech narsani o'zgartirmaydi
function callIdentityToolkitPublic_(method, payload) {
  const url = 'https://identitytoolkit.googleapis.com/v1/' + method + '?key=' + FIREBASE_API_KEY;
  const res = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify(payload), muteHttpExceptions: true
  });
  return JSON.parse(res.getContentText());
}

// Realtime Database'dan admin (service-account) huquqi bilan o'qish — Database Rules'ni chetlab o'tadi
function dbGet_(accessToken, path) {
  const url = FIREBASE_DB_URL + '/' + path + '.json';
  const res = UrlFetchApp.fetch(url, {
    method: 'get', headers: { Authorization: 'Bearer ' + accessToken }, muteHttpExceptions: true
  });
  return JSON.parse(res.getContentText());
}

// Admin huquqi bilan parolni majburan o'zgartirish (bu — oddiy client SDK qila olmaydigan qism)
function callIdentityToolkitAdmin_(accessToken, uid, newPassword) {
  const url = 'https://identitytoolkit.googleapis.com/v1/projects/' + FIREBASE_PROJECT_ID + '/accounts:update';
  const res = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + accessToken },
    payload: JSON.stringify({ localId: uid, password: newPassword, returnSecureToken: false }),
    muteHttpExceptions: true
  });
  const parsed = JSON.parse(res.getContentText());
  if (parsed.error) throw new Error(parsed.error.message || 'Identity Toolkit xatosi');
  return parsed;
}

/* ---- Service Account JSON kaliti bilan Google OAuth2 access token olish ---- */
function getServiceAccountToken_() {
  const props = PropertiesService.getScriptProperties();
  const cached = props.getProperty('SA_TOKEN');
  const cachedExp = Number(props.getProperty('SA_TOKEN_EXP') || 0);
  if (cached && Date.now() < cachedExp - 60000) return cached;

  const keyJsonRaw = props.getProperty('SERVICE_ACCOUNT_JSON');
  if (!keyJsonRaw) throw new Error("Script Properties'da SERVICE_ACCOUNT_JSON topilmadi. README'ga qarang.");
  const keyJson = JSON.parse(keyJsonRaw);

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: keyJson.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };
  const header = { alg: 'RS256', typ: 'JWT' };
  const toSign = base64url_(JSON.stringify(header)) + '.' + base64url_(JSON.stringify(claim));
  const signatureBytes = Utilities.computeRsaSha256Signature(toSign, keyJson.private_key);
  const jwt = toSign + '.' + Utilities.base64EncodeWebSafe(signatureBytes).replace(/=+$/, '');

  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt },
    muteHttpExceptions: true
  });
  const data = JSON.parse(res.getContentText());
  if (!data.access_token) throw new Error('Service account tokeni olinmadi: ' + res.getContentText());

  props.setProperty('SA_TOKEN', data.access_token);
  props.setProperty('SA_TOKEN_EXP', String(Date.now() + data.expires_in * 1000));
  return data.access_token;
}

function base64url_(str) {
  return Utilities.base64EncodeWebSafe(Utilities.newBlob(str).getBytes()).replace(/=+$/, '');
}
