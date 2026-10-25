/* ============================================================================
   汉字练习 — HANZI MASHQLARI moduli (Laoshi Test uchun)
   ----------------------------------------------------------------------------
   index.html dan keyin yuklanadi va uning umumiy yordamchilaridan foydalanadi:
   db, auth, currentUser, currentProfile, $, app, esc, uid, fmtD, fmtDT,
   logEvent, trashPut, menuHtml, downloadFile, csvCell, XLSX.

   Bazadagi yangi tugunlar (mavjud tugunlarga tegilmaydi):
     hanziWords/{wid}                    umumiy so'zlar bazasi (barcha laoshilar)
     hanziGroups/{ownerUid}/{gid}        guruhlar + o'quvchi kodlari (faqat egasi/admin)
     hanziRoster/{gid}/{hash}            kod xeshi -> o'quvchi id (kodni bilgan kishigina topadi)
     hanziAssignments/{aid}              topshiriq (o'quvchiga ochiq, javob kalitisiz)
     hanziKeys/{aid}                     to'g'ri javoblar (faqat egasi/admin)
     hanziSessions/{aid}/{sid}           o'quvchi javoblari
     hanziReviews/{aid}/{sid}            avtomatik natija + laoshi bahosi (faqat laoshi yozadi)
   Qoidalar: README → "Hanzi mashqlari".
   ============================================================================ */
(function(){
'use strict';

const HZ = window.HZ = {};

/* ------------------------------------------------------------------ CSS */
document.head.insertAdjacentHTML('beforeend', `<style id="hz-style">
.hz-sub{display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
.hz-sub::-webkit-scrollbar{display:none}
.hz-sub .tab{font-size:13px;padding:6px 13px}
.hz-han{font-family:"KaiTi","STKaiti","Kaiti SC",var(--serif);}
.hz-big{font-size:34px;line-height:1.1}
.hz-grid{position:relative;background:#fff;border-radius:8px;box-shadow:inset 0 0 0 1px var(--line);touch-action:none;flex:none}
.hz-grid>svg.hz-lines{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.hz-grid>.hz-host,.hz-grid>svg.hz-draw{position:absolute;inset:0;width:100%;height:100%}
.hz-grid .hz-msg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;
  padding:8px;font-size:12px;color:var(--ink-soft)}
.hz-pads{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start}
.hz-pad{display:flex;flex-direction:column;align-items:center;gap:6px}
.hz-pad .hz-tools{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;align-items:center}
.hz-chip{display:inline-flex;align-items:center;gap:6px;border:1.5px solid var(--line);border-radius:99px;padding:3px 10px;
  font-size:13px;background:#fff;cursor:pointer;margin:0 6px 6px 0}
.hz-chip.on{border-color:var(--ink);background:#F4F6F8}
.hz-wordpick{max-height:300px;overflow-y:auto;border:1px solid var(--line);border-radius:10px;padding:6px;background:#fff}
.hz-wordpick button{display:flex;gap:8px;align-items:center;width:100%;text-align:left;background:transparent;
  font-weight:500;padding:7px 8px;border-radius:7px}
.hz-wordpick button:hover{background:#F2F4F6}
.hz-check{display:flex;align-items:flex-start;gap:8px;font-weight:500;margin:8px 0 0}
.hz-check input{width:auto;margin-top:3px}
.hz-v-correct{border-left:4px solid var(--jade)!important}
.hz-v-incorrect{border-left:4px solid var(--red)!important}
.hz-v-unanswered{border-left:4px solid #B9BFC6!important}
.hz-qr{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start}
.hz-qr img{width:180px;height:180px;border:1px solid var(--line);border-radius:10px;background:#fff;image-rendering:pixelated}
.hz-sticky{position:sticky;bottom:0;z-index:40;background:rgba(246,245,241,.95);backdrop-filter:blur(8px);
  border-top:1px solid var(--line);padding:10px 0;margin-top:10px}
.hz-codes td{font-family:ui-monospace,monospace}
@media print{ body *{visibility:hidden} .hz-print, .hz-print *{visibility:visible} .hz-print{position:absolute;left:0;top:0;width:100%} }
</style>`);

/* ------------------------------------------------------------------ konstantalar */
const TYPES = ['writing','hanzi_input','pinyin','translation','dictation'];
const TYPE_LABEL = { writing:'✍️ Hanzi yozish', hanzi_input:'⌨️ Hanzi kiritish', pinyin:'🔤 Pinyin', translation:'🌐 Tarjima', dictation:'🔊 Diktant' };
const TYPE_HELP = {
  writing:"Pinyin va ma'no ko'rsatiladi, o'quvchi ieroglifni chizadi — HanziWriter chiziqlar tartibini tekshiradi.",
  hanzi_input:"Pinyin va ma'no ko'rsatiladi, o'quvchi ieroglifni klaviaturada (xitoycha pinyin klaviatura) yozadi.",
  pinyin:"Ieroglif va ma'no ko'rsatiladi, o'quvchi pinyinni yozadi (nǐ hǎo yoki ni3 hao3 — ikkalasi qabul qilinadi).",
  translation:"Ieroglif va pinyin ko'rsatiladi, o'quvchi o'zbekcha tarjimasini yozadi.",
  dictation:"So'z qurilma ovozida o'qib beriladi, o'quvchi ieroglifda yozadi."
};
const STATUS = {
  not_started:{t:"Yuborilmagan", p:'p-gray'}, draft:{t:"Yuborilmagan", p:'p-gray'},
  submitted:{t:"Yuborilgan", p:'p-blue'}, in_review:{t:"Tekshirilmoqda", p:'p-yellow'},
  needs_revision:{t:"Qayta ishlash kerak", p:'p-red'}, reviewed:{t:"Tekshirildi", p:'p-green'}
};
const VERDICT = { correct:{t:"To'g'ri", p:'p-green'}, incorrect:{t:"Noto'g'ri", p:'p-red'}, unanswered:{t:"Laoshi tekshiradi", p:'p-gray'} };
const MAX_WORDS = 40;
const HW_URL = 'https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js';
const HW_DATA = 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0';
const CODE_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const H = {};          // holat: assignments, words, groups, view, ...
HZ._H = H;             // (diagnostika uchun)
H.view = 'list'; H.assignments = {}; H.words = {}; H.groups = {}; H.refs = [];

const isAdmin = () => currentProfile && currentProfile.role === 'admin';
const me = () => currentUser.uid;
const myName = () => (currentProfile && currentProfile.name) || currentUser.email;
const rnd = n => Array.from({length:n},()=>'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random()*31)]).join('');
const pill = (cls, txt) => `<span class="pill ${cls}">${txt}</span>`;
const itemKeys = items => Object.keys(items||{}).sort();
const linkFor = q => location.origin + location.pathname + q;
/* Foydalanuvchi matnini inline onclick ichiga xavfsiz qo'yish: JS satri + HTML-escape (o'zbekcha apostrof ham buzmaydi). */
const jsq = s => esc(JSON.stringify(String(s==null?'':s)));

/* ======================================================================
   1. AVTOMATIK TEKSHIRISH (sof funksiyalar)
   ====================================================================== */
const TONE_MARK = {'\u0304':1,'\u0301':2,'\u030C':3,'\u0300':4};
/** "Nǐ hǎo" / "ni3 hao3" / "nǐhǎo" -> "nihao|33". Neytral ton hisobga olinmaydi. */
function normPinyin(input, tones){
  const s = String(input||'').toLowerCase().replace(/u:/g,'ü').normalize('NFD');
  let letters = ''; const t = [];
  for(const ch of s){
    if(ch>='a' && ch<='z'){ letters += ch; continue; }
    if(ch==='\u0308'){ if(letters.endsWith('u')) letters = letters.slice(0,-1)+'v'; continue; }
    if(TONE_MARK[ch]){ t.push(TONE_MARK[ch]); continue; }
    if(ch>='1' && ch<='4'){ t.push(+ch); continue; }
  }
  return tones===false ? letters : letters+'|'+t.join('');
}
function normTr(s){
  return String(s||'').toLowerCase().normalize('NFC')
    .replace(/[\u2018\u2019\u02BB\u02BC\u0060\u00B4\u2032]/g,"'")
    .replace(/[.,!?;:"()[\]{}«»…—–]/g,' ').replace(/\s+/g,' ').trim();
}
function normHan(s){ return String(s||'').normalize('NFC').replace(/[\s.,!?;:'"()[\]{}。，！？、；：‘’“”（）《》…—·]/g,''); }
function splitAlt(s){ return String(s||'').split(/[;/,，；]/).map(x=>x.trim()).filter(Boolean); }

function checkItem(item, key, ans, opt){
  const text = ans && ans.text ? String(ans.text).trim() : '';
  switch(item.type){
    case 'pinyin':
      if(!text) return 'unanswered';
      return (key.accepted||[]).some(a=> normPinyin(a,opt.requireTones)===normPinyin(text,opt.requireTones)) ? 'correct' : 'incorrect';
    case 'translation': {
      if(!text) return 'unanswered';
      const acc = (key.accepted||[]).flatMap(a=>[a, ...splitAlt(a)]).map(normTr);
      return acc.includes(normTr(text)) ? 'correct' : 'incorrect';
    }
    case 'hanzi_input': case 'dictation':
      if(!text) return 'unanswered';
      return (key.accepted||[]).some(a=> normHan(a)===normHan(text)) ? 'correct' : 'incorrect';
    case 'writing': {
      const w = (ans && ans.writing) || [];
      const need = item.charCount || w.length;
      const done = w.length>0 && w.length>=need && w.every(c=>c && c.completed);
      if(!done) return 'unanswered';   // masalan faqat erkin chizma — laoshi baholaydi
      return w.every(c=> (c.mistakes||0) <= opt.tolerance) ? 'correct' : 'incorrect';
    }
  }
  return 'unanswered';
}
/** Ball savollarga teng taqsimlanadi, 0.1 aniqlikda. */
function grade(a, keys, answers){
  const verdicts = {}, wrongWords = []; let correct = 0;
  const ids = itemKeys(a.items);
  ids.forEach(id=>{
    const item = a.items[id], key = keys && keys[id];
    const v = key ? checkItem(item, key, (answers||{})[id], {requireTones:a.requireTones!==false, tolerance:a.tolerance??3}) : 'unanswered';
    verdicts[id] = v;
    if(v==='correct') correct++; else if(key && key.hanzi) wrongWords.push(key.hanzi);
  });
  const total = ids.length;
  const score = total ? Math.round(a.maxScore*correct*10/total)/10 : 0;
  return {score, maxScore:a.maxScore, correct, total, verdicts, wrongWords};
}
function scoreWithOverrides(a, verdicts, overrides){
  const ids = itemKeys(a.items); if(!ids.length) return 0;
  const c = ids.filter(id=> ((overrides||{})[id] || (verdicts||{})[id]) === 'correct').length;
  return Math.round(a.maxScore*c*10/ids.length)/10;
}

/* pinyin: ton raqamlaridan belgiga */
const MARKS = {a:'āáǎà',e:'ēéěè',i:'īíǐì',o:'ōóǒò',u:'ūúǔù','ü':'ǖǘǚǜ'};
function markSyl(syl, tone){
  const s = syl.replace(/v|u:/g,'ü').replace(/V|U:/g,'Ü');
  if(tone<1||tone>4) return s;
  const low = s.toLowerCase();
  let i = low.search(/[ae]/); if(i<0) i = low.indexOf('ou');
  if(i<0) for(let k=low.length-1;k>=0;k--) if('iouü'.includes(low[k])){ i=k; break; }
  if(i<0) return s;
  const m = MARKS[low[i]][tone-1]; const up = s[i]!==low[i];
  return s.slice(0,i) + (up?m.toUpperCase():m) + s.slice(i+1);
}
function toMarks(s){ return String(s||'').replace(/([a-zA-ZüÜ:]+)([1-5])/g,(_,a,b)=>markSyl(a,+b)); }
const isHan = s => { const c=[...String(s||'').replace(/\s/g,'')]; return c.length>0 && c.every(x=>/\p{Script=Han}/u.test(x)); };

HZ._test = { normPinyin, normTr, normHan, checkItem, grade, toMarks, scoreWithOverrides };

/* ======================================================================
   2. QR-KOD (tashqi xizmatsiz; ISO 18004, bayt rejimi, M daraja)
   Algoritm Project Nayuki'ning ochiq (public-domain) dizayniga asoslangan.
   ====================================================================== */
const QR_ECC = [-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28];
const QR_BLK = [-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49];
function qrRaw(v){ let r=(16*v+128)*v+64; if(v>=2){ const n=Math.floor(v/7)+2; r-=(25*n-10)*n-55; if(v>=7) r-=36; } return r; }
function qrData(v){ return Math.floor(qrRaw(v)/8) - QR_ECC[v]*QR_BLK[v]; }
function gfMul(x,y){ let z=0; for(let i=7;i>=0;i--){ z=(z<<1)^((z>>>7)*0x11d); z^=((y>>>i)&1)*x; } return z&0xff; }
function rsDiv(d){ const r=new Array(d).fill(0); r[d-1]=1; let root=1;
  for(let i=0;i<d;i++){ for(let j=0;j<r.length;j++){ r[j]=gfMul(r[j],root); if(j+1<r.length) r[j]^=r[j+1]; } root=gfMul(root,2); } return r; }
function rsRem(data, div){ const r=div.map(()=>0);
  for(const b of data){ const f=b^r.shift(); r.push(0); div.forEach((c,i)=>{ r[i]^=gfMul(c,f); }); } return r; }
function qrEncode(text){
  const bytes = Array.from(new TextEncoder().encode(text));
  let v=1; for(;v<=40;v++){ if(4+(v<=9?8:16)+bytes.length*8 <= qrData(v)*8) break; }
  if(v>40) throw new Error('QR uchun matn juda uzun');
  const bits=[]; const push=(x,n)=>{ for(let i=n-1;i>=0;i--) bits.push((x>>>i)&1); };
  push(4,4); push(bytes.length, v<=9?8:16); bytes.forEach(b=>push(b,8));
  const cap=qrData(v)*8; push(0,Math.min(4,cap-bits.length)); push(0,(8-bits.length%8)%8);
  for(let p=0xec; bits.length<cap; p^=0xec^0x11) push(p,8);
  const dc=[]; for(let i=0;i<bits.length;i+=8){ let x=0; for(let j=0;j<8;j++) x=(x<<1)|bits[i+j]; dc.push(x); }
  const nb=QR_BLK[v], el=QR_ECC[v], raw=Math.floor(qrRaw(v)/8), ns=nb-raw%nb, sl=Math.floor(raw/nb), dv=rsDiv(el), blocks=[];
  for(let i=0,k=0;i<nb;i++){ const d=dc.slice(k,k+sl-el+(i<ns?0:1)); k+=d.length; const e=rsRem(d,dv); if(i<ns) d.push(0); blocks.push(d.concat(e)); }
  const cw=[]; for(let i=0;i<blocks[0].length;i++) blocks.forEach((b,j)=>{ if(i!==sl-el || j>=ns) cw.push(b[i]); });
  const size=v*4+17, M=[...Array(size)].map(()=>Array(size).fill(false)), F=[...Array(size)].map(()=>Array(size).fill(false));
  const set=(x,y,d)=>{ M[y][x]=d; F[y][x]=true; };
  for(let i=0;i<size;i++){ set(6,i,i%2===0); set(i,6,i%2===0); }
  const finder=(cx,cy)=>{ for(let dy=-4;dy<=4;dy++) for(let dx=-4;dx<=4;dx++){ const d=Math.max(Math.abs(dx),Math.abs(dy)), x=cx+dx, y=cy+dy;
    if(x>=0&&x<size&&y>=0&&y<size) set(x,y,d!==2&&d!==4); } };
  finder(3,3); finder(size-4,3); finder(3,size-4);
  if(v>1){ const na=Math.floor(v/7)+2, st=v===32?26:Math.ceil((v*4+4)/(na*2-2))*2, pos=[6];
    for(let p=size-7;pos.length<na;p-=st) pos.splice(1,0,p);
    for(let i=0;i<na;i++) for(let j=0;j<na;j++){ if((i===0&&j===0)||(i===0&&j===na-1)||(i===na-1&&j===0)) continue;
      for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++) set(pos[i]+dx,pos[j]+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1); } }
  const fmt=mask=>{ const data=mask; let r=data; for(let i=0;i<10;i++) r=(r<<1)^((r>>>9)*0x537);
    const b=((data<<10)|r)^0x5412, g=i=>((b>>>i)&1)!==0;
    for(let i=0;i<=5;i++) set(8,i,g(i)); set(8,7,g(6)); set(8,8,g(7)); set(7,8,g(8));
    for(let i=9;i<15;i++) set(14-i,8,g(i)); for(let i=0;i<8;i++) set(size-1-i,8,g(i));
    for(let i=8;i<15;i++) set(8,size-15+i,g(i)); set(8,size-8,true); };
  fmt(0);
  if(v>=7){ let r=v; for(let i=0;i<12;i++) r=(r<<1)^((r>>>11)*0x1f25); const b=(v<<12)|r;
    for(let i=0;i<18;i++){ const d=((b>>>i)&1)!==0, a=size-11+i%3, c=Math.floor(i/3); set(a,c,d); set(c,a,d); } }
  let bi=0;
  for(let right=size-1;right>=1;right-=2){ if(right===6) right=5;
    for(let vert=0;vert<size;vert++) for(let j=0;j<2;j++){ const x=right-j, up=((right+1)&2)===0, y=up?size-1-vert:vert;
      if(!F[y][x] && bi<cw.length*8){ M[y][x]=((cw[bi>>>3]>>>(7-(bi&7)))&1)!==0; bi++; } } }
  const mf=(m,x,y)=>[(x+y)%2===0, y%2===0, x%3===0, (x+y)%3===0, (Math.floor(x/3)+Math.floor(y/2))%2===0,
    (x*y)%2+(x*y)%3===0, ((x*y)%2+(x*y)%3)%2===0, ((x+y)%2+(x*y)%3)%2===0][m];
  const apply=m=>{ for(let y=0;y<size;y++) for(let x=0;x<size;x++) if(!F[y][x]&&mf(m,x,y)) M[y][x]=!M[y][x]; };
  const pen=()=>{ let s=0;
    for(let a=0;a<size;a++) for(const hz of [true,false]){ let run=1;
      for(let b=1;b<size;b++){ const c=hz?M[a][b]:M[b][a], p=hz?M[a][b-1]:M[b-1][a]; if(c===p){ run++; if(run===5) s+=3; else if(run>5) s++; } else run=1; } }
    for(let y=0;y<size-1;y++) for(let x=0;x<size-1;x++){ const c=M[y][x]; if(c===M[y][x+1]&&c===M[y+1][x]&&c===M[y+1][x+1]) s+=3; }
    let dark=0; M.forEach(r=>r.forEach(m=>{ if(m) dark++; })); const tot=size*size;
    return s + Math.max(0,Math.ceil(Math.abs(dark*20-tot*10)/tot)-1)*10; };
  let best=0, bs=Infinity;
  for(let m=0;m<8;m++){ apply(m); fmt(m); const s=pen(); if(s<bs){ bs=s; best=m; } apply(m); }
  apply(best); fmt(best);
  return M;
}
function qrPng(text, px){
  const m=qrEncode(text), n=m.length+8, sc=Math.max(1,Math.floor((px||512)/n));
  const c=document.createElement('canvas'); c.width=c.height=n*sc;
  const x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,c.width,c.height); x.fillStyle='#212A33';
  m.forEach((r,y)=>r.forEach((d,xx)=>{ if(d) x.fillRect((xx+4)*sc,(y+4)*sc,sc,sc); }));
  return c.toDataURL('image/png');
}
HZ.qrEncode = qrEncode;
function qrBlock(link, fileBase, help){
  let src = ''; try { src = qrPng(link, 540); } catch(e){ console.warn(e); }
  const id = 'q'+rnd(6);
  return `<div class="hz-qr">
    ${src ? `<img id="${id}" src="${src}" alt="QR">` : ''}
    <div style="flex:1;min-width:220px">
      ${help ? `<p class="muted">${help}</p>` : ''}
      <div class="linkbox" style="margin-top:8px">
        <input readonly value="${esc(link)}" onclick="this.select()">
        <button class="btn-p btn-sm" onclick="HZ.copy(${jsq(link)},this)">Nusxa</button>
      </div>
      <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
        ${src ? `<button class="btn-ghost btn-sm" onclick="HZ.dlQR('${id}',${jsq(fileBase)})">⬇ QR (PNG)</button>` : ''}
        <a class="btn-ghost btn-sm" style="text-decoration:none;color:inherit;display:inline-block;border:1.5px solid var(--line);border-radius:7px" href="${esc(link)}" target="_blank">Ochish ↗</a>
      </div>
    </div></div>`;
}
HZ.dlQR = (id, base)=>{ const img=document.getElementById(id); if(!img) return;
  const a=document.createElement('a'); a.href=img.src; a.download=(base||'hanzi').replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,60)+'-QR.png';
  document.body.appendChild(a); a.click(); a.remove(); };
HZ.copy = (text, btn)=>{ navigator.clipboard.writeText(text).then(()=>{ if(btn) btn.textContent='✓ Nusxalandi'; }, ()=> prompt('Havolani nusxalab oling:', text)); };

/* ======================================================================
   3. HANZIWRITER, OVOZ, KATAK
   ====================================================================== */
/* HanziWriter (MIT, hanziwriter.org) faqat yozish mashqi ekranda ochilganda yuklanadi.
   U ieroglifni ma'lum to'g'ri ieroglif bilan chiziqma-chiziq solishtiradi — bu OCR emas:
   erkin chizilgan ixtiyoriy yozuvni taniy olmaydi. */
let hwPromise = null;
function loadHW(){
  if(window.HanziWriter) return Promise.resolve(window.HanziWriter);
  hwPromise = hwPromise || new Promise((ok, fail)=>{
    const s=document.createElement('script'); s.src=HW_URL; s.async=true;
    s.onload=()=> window.HanziWriter ? ok(window.HanziWriter) : fail(new Error('HanziWriter yo‘q'));
    s.onerror=()=> fail(new Error('HanziWriter yuklanmadi'));
    document.head.appendChild(s);
  }).catch(e=>{ hwPromise=null; throw e; });
  return hwPromise;
}
const charCache = {};
function loadChar(ch){
  if(!charCache[ch]){
    charCache[ch] = fetch(HW_DATA+'/'+encodeURIComponent(ch)+'.json').then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); });
    charCache[ch].catch(()=>{ delete charCache[ch]; });
  }
  return charCache[ch];
}
function prefetchChars(chars){ [...new Set(chars)].forEach(c=>{ if(c.trim()) loadChar(c).catch(()=>{}); }); }
function gridSvg(type){
  return `<svg class="hz-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <rect x=".75" y=".75" width="98.5" height="98.5" fill="none" stroke="#BE3A2B" stroke-opacity=".75" stroke-width="1.5"/>
    <g stroke="#BE3A2B" stroke-opacity=".45" stroke-width=".6" stroke-dasharray="3 2.5" fill="none">
      <line x1="50" y1="0" x2="50" y2="100"/><line x1="0" y1="50" x2="100" y2="50"/>
      ${type==='mi' ? '<line x1="0" y1="0" x2="100" y2="100"/><line x1="100" y1="0" x2="0" y2="100"/>' : ''}
    </g></svg>`;
}
/* HanziWriter nuqtalari ichki 1024 birlikli fazoda (y yuqoriga): 1024×1024 yuqoridan-pastga ko'rinishga o'tkazamiz. */
function ptsToPath(pts){ if(!pts||!pts.length) return ''; return pts.map((p,i)=>(i?'L':'M')+Math.round(p.x)+' '+Math.round(900-p.y)).join(' '); }
function strokesSvg(paths, box, gridType, size, ghost, label){
  const p = paths || {};
  return `<div style="display:inline-flex;flex-direction:column;align-items:center;gap:3px;margin:0 8px 8px 0">
    <div class="hz-grid" style="width:${size}px;height:${size}px">${gridSvg(gridType)}
      ${ghost ? `<div class="hz-msg hz-han" style="font-size:${Math.round(size*.78)}px;color:rgba(33,42,51,.12);padding:0">${esc(ghost)}</div>` : ''}
      <svg class="hz-draw" viewBox="0 0 ${box} ${box}">
        ${p.wrong ? `<path d="${esc(p.wrong)}" fill="none" stroke="#BE3A2B" stroke-opacity=".7" stroke-width="${box*.03}" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
        ${p.ok ? `<path d="${esc(p.ok)}" fill="none" stroke="#212A33" stroke-width="${box*.035}" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
      </svg></div>
    ${label ? `<span class="muted" style="font-size:12px">${esc(label)}</span>` : ''}</div>`;
}
function speak(text, rate){
  if(!('speechSynthesis' in window)) return false;
  const s=window.speechSynthesis; s.cancel();
  const u=new SpeechSynthesisUtterance(text); u.lang='zh-CN'; u.rate=rate||0.8;
  const v=s.getVoices().find(x=>/^zh(-|_)?cn/i.test(x.lang)) || s.getVoices().find(x=>/^zh/i.test(x.lang)); if(v) u.voice=v;
  s.speak(u); return true;
}
const hasZhVoice = ()=> 'speechSynthesis' in window && speechSynthesis.getVoices().some(v=>/^zh/i.test(v.lang));
HZ.speak = (aid, id, rate)=>{ const it = (ST && ST.a.items[id]); if(it && it.target) speak(it.target, rate); };

/* Laoshi uchun: chiziq tartibi animatsiyasi */
HZ.strokeAnim = (wid)=>{
  const w = H.words[wid]; if(!w) return;
  const chars = [...w.hanzi.replace(/\s/g,'')];
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-bg" onclick="if(event.target===this)this.remove()"><div class="modal">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <h2 style="margin:0"><span class="hz-han">${esc(w.hanzi)}</span> · ${esc(w.pinyin)}</h2>
      <button class="btn-ghost btn-sm" onclick="this.closest('.modal-bg').remove()">✕</button></div>
    <div class="hz-pads" style="justify-content:center">${chars.map((c,i)=>`<div class="hz-grid" style="width:150px;height:150px">${gridSvg('mi')}<div class="hz-host" id="sa${i}"></div><div class="hz-msg" id="sam${i}">Yuklanmoqda…</div></div>`).join('')}</div>
    <p class="muted center" style="margin-top:10px">${esc(w.translation)}</p></div></div>`);
  loadHW().then(HW=> chars.forEach((c,i)=>{
    const host=document.getElementById('sa'+i); if(!host) return;
    const w2=HW.create(host, c, { width:150, height:150, padding:8, strokeColor:'#212A33', outlineColor:'#E3E1DA', delayBetweenLoops:1400,
      charDataLoader:(ch,ok,err)=>{ loadChar(ch).then(ok,err); },
      onLoadCharDataSuccess:()=>{ const m=document.getElementById('sam'+i); if(m) m.remove(); },
      onLoadCharDataError:()=>{ const m=document.getElementById('sam'+i); if(m) m.textContent='Chiziq maʼlumoti yuklanmadi'; } });
    w2.loopCharacterAnimation();
  })).catch(()=> chars.forEach((c,i)=>{ const m=document.getElementById('sam'+i); if(m) m.textContent='HanziWriter yuklanmadi (internet?)'; }));
};

/* ======================================================================
   4. LAOSHI PANELI — ma'lumotlarni tinglash
   ====================================================================== */
function attach(){
  if(H.attachedFor === me()) return;
  HZ.detach();
  H.attachedFor = me();
  const aRef = isAdmin() ? db.ref('hanziAssignments') : db.ref('hanziAssignments').orderByChild('ownerUid').equalTo(me());
  aRef.on('value', s=>{ H.assignments = s.val()||{}; H.aLoaded = true; rerender('assignments'); }, e=> onErr(e,'hanziAssignments'));
  const wRef = db.ref('hanziWords');
  wRef.on('value', s=>{ H.words = s.val()||{}; H.wLoaded = true; rerender('words'); }, e=> onErr(e,'hanziWords'));
  const gRef = isAdmin() ? db.ref('hanziGroups') : db.ref('hanziGroups/'+me());
  gRef.on('value', s=>{
    const v = s.val()||{}; const flat = {};
    if(isAdmin()) Object.entries(v).forEach(([o,gs])=> Object.entries(gs||{}).forEach(([gid,g])=> flat[gid]=Object.assign({_owner:o},g)));
    else Object.entries(v).forEach(([gid,g])=> flat[gid]=Object.assign({_owner:me()},g));
    H.groups = flat; H.gLoaded = true; rerender('groups');
  }, e=> onErr(e,'hanziGroups'));
  H.refs = [aRef, wRef, gRef];
}
HZ.detach = ()=>{ (H.refs||[]).forEach(r=>r.off()); H.refs=[]; H.attachedFor=null; if(H.detailRefs){ H.detailRefs.forEach(r=>r.off()); H.detailRefs=null; } };
function onErr(e, node){
  console.warn(node, e);
  H.err = `<div class="note red"><b>${esc(node)}</b> o'qilmadi: ${esc(e.message)}<br>
    Firebase Database Rules'ga "Hanzi mashqlari" bloklari qo'shilganini tekshiring (README → Hanzi mashqlari).</div>`;
  rerender('error');
}
function rerender(what){
  if(typeof adminTab === 'undefined' || adminTab !== 'hanzi' || !$('#hzBody')) return;
  const v = H.view;
  if(what==='error'){ draw(); return; }
  if(v==='list' || v==='review' || v==='stats') draw();
  else if(v==='words' && what==='words') draw();
  else if(v==='groups' && what==='groups') draw();
  else if(v==='edit' && what==='words' && $('#hz-pick')) drawPicker();
  else if(v==='detail' && what==='assignments') drawDetail();
}

/* ======================================================================
   5. LAOSHI PANELI — ekranlar
   ====================================================================== */
const SUBTABS = [['list','📚 Topshiriqlar'],['edit','➕ Yangi topshiriq'],['review','✅ Tekshirish'],['words',"📖 So'zlar bazasi"],['groups','👥 Guruhlar va kodlar'],['stats','📈 Statistika']];
HZ.render = ()=>{
  attach();
  $('#tabBody').innerHTML = `
    <div class="card" style="padding:14px 16px">
      <h2 style="margin-bottom:8px"><span class="hz-han">汉字练习</span> · Hanzi mashqlari</h2>
      <div class="hz-sub" id="hzSub"></div>
    </div>
    <div id="hzBody"></div>`;
  draw();
};
HZ.go = (view, arg, arg2)=>{
  if(H.detailRefs && view!=='detail' && view!=='rv'){ H.detailRefs.forEach(r=>r.off()); H.detailRefs=null; }
  H.view = view;
  if(view==='edit') H.editId = arg || null;
  if(view==='detail' || view==='rv'){ H.cur = arg; }
  if(view==='rv') H.rvSid = arg2;
  draw();
  window.scrollTo(0,0);
};
function draw(){
  const sub = $('#hzSub'); if(!sub) return;
  const cur = H.view==='detail'||H.view==='rv' ? 'list' : (H.view==='edit' && H.editId ? 'list' : H.view);
  sub.innerHTML = SUBTABS.map(([k,l])=>`<div class="tab ${cur===k?'on':''}" onclick="HZ.go('${k}')">${l}</div>`).join('');
  const body = $('#hzBody');
  if(H.err){ body.innerHTML = H.err; H.err = null; return; }
  if(H.view==='list') return drawList();
  if(H.view==='edit') return drawEdit();
  if(H.view==='words') return drawWords();
  if(H.view==='groups') return drawGroups();
  if(H.view==='detail') return drawDetail();
  if(H.view==='rv') return drawReview();
  if(H.view==='review') return drawQueue();
  if(H.view==='stats') return drawStats();
}

/* ---------------- 5.1 Topshiriqlar ro'yxati ---------------- */
const A_STATUS = { draft:pill('p-gray','Qoralama'), published:pill('p-green','E‘lon qilingan'), closed:pill('p-red','🔒 Yopiq') };
function drawList(){
  const ids = Object.keys(H.assignments).sort((a,b)=>(H.assignments[b].createdAt||0)-(H.assignments[a].createdAt||0));
  $('#hzBody').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
      <p class="muted">${isAdmin()?'Administrator sifatida barcha laoshilarning topshiriqlari ko‘rinadi.':'Siz yaratgan Hanzi topshiriqlari.'}</p>
      <button class="btn-red" onclick="HZ.go('edit')">➕ Yangi topshiriq</button>
    </div>
    ${!H.aLoaded ? '<p class="muted">Yuklanmoqda…</p>' : !ids.length ? `<div class="card"><div class="empty"><span class="ico">汉</span>Hali topshiriq yo'q.<br>Avval "📖 So'zlar bazasi"ga so'z qo'shing, so'ng "➕ Yangi topshiriq".</div></div>` :
      ids.map(id=>{
        const a = H.assignments[id];
        return `<div class="lrow">
          <div class="lrow-main">
            <div class="lrow-title">${esc(a.title)} ${A_STATUS[a.status]||''}
              ${a.access==='code' ? pill('p-blue','🔑 '+esc(a.groupName||'guruh')) : pill('p-gray','ism bilan')}
              ${isAdmin() && a.ownerUid!==me() ? pill('p-gray', esc(a.ownerName||'')) : ''}</div>
            <div class="lrow-sub">${a.itemCount||0} savol · ${Object.keys(a.exerciseTypes||{}).map(t=>TYPE_LABEL[t]).join(', ')}</div>
            <div class="lrow-sub">${a.dueAt ? 'Muddat: '+fmtDT(a.dueAt) : 'Muddatsiz'} · ${a.maxScore} ball · ${a.maxAttempts} urinish</div>
          </div>
          <div class="lrow-act">
            <button class="btn-jade btn-sm" onclick="HZ.go('detail','${id}')">📊 Ochish</button>
            ${a.status==='draft' ? `<button class="btn-red btn-sm" onclick="HZ.publish('${id}')">📣 E'lon qilish</button>` : ''}
            ${menuHtml('hzm-'+id, [
              {label:'✏️ Tahrirlash', fn:`HZ.go('edit','${id}')`},
              a.status==='published' && {label:'🔒 Yakunlash', fn:`HZ.setStatus('${id}','closed')`},
              a.status==='closed' && {label:'🔓 Qayta ochish', fn:`HZ.setStatus('${id}','published')`},
              a.status!=='draft' && {label:'🔗 Havolani nusxalash', fn:`HZ.copy(${jsq(linkFor('?hz='+id))})`},
              {label:'🗑 Korzinkaga', fn:`HZ.del('${id}')`, danger:true}
            ])}
          </div></div>`;
      }).join('')}`;
}
HZ.publish = id=>{
  const a = H.assignments[id]; if(!a) return;
  if(!a.itemCount) return alert("Topshiriqda savol yo'q.");
  if(!confirm(`"${a.title}" e'lon qilinsinmi? O'quvchilar havola/QR orqali ocha oladi.\n\nE'londan keyin so'zlar va mashq turlari qulflanadi (natijalar buzilmasligi uchun).`)) return;
  db.ref('hanziAssignments/'+id).update({status:'published', publishedAt:Date.now()})
    .then(()=> logEvent('hanzi.publish', { testId:id, testTitle:a.title, ownerUid:a.ownerUid, ownerName:a.ownerName }))
    .then(()=> HZ.go('detail', id))
    .catch(e=> alert("E'lon qilib bo'lmadi: "+e.message));
};
HZ.setStatus = (id, st)=>{
  const a = H.assignments[id]; if(!a) return;
  db.ref('hanziAssignments/'+id+'/status').set(st)
    .then(()=> logEvent(st==='closed'?'hanzi.close':'hanzi.open', { testId:id, testTitle:a.title, ownerUid:a.ownerUid, ownerName:a.ownerName }))
    .catch(e=> alert('Xatolik: '+e.message));
};
/* O'chirilgan topshiriq javob kalitlari, o'quvchi javoblari va baholari bilan birga korzinkaga tushadi. */
HZ.del = id=>{
  const a = H.assignments[id]; if(!a) return;
  if(!confirm(`"${a.title}" korzinkaga o'tkazilsinmi? Javoblar va baholar ham u bilan birga saqlanadi, keyin tiklash mumkin.`)) return;
  Promise.all(['hanziKeys','hanziSessions','hanziReviews'].map(n=> db.ref(n+'/'+id).once('value').then(s=>s.val()).catch(()=>null)))
    .then(([keys, sessions, reviews])=>{
      const n = sessions ? Object.keys(sessions).length : 0;
      return trashPut('hanzi', a.ownerUid, a.title, {assignment:a, keys, sessions, reviews}, {testId:id, note:`Hanzi · ${a.itemCount||0} savol · ${n} ta javob`})
        .then(()=> db.ref().update({['hanziAssignments/'+id]:null, ['hanziKeys/'+id]:null, ['hanziSessions/'+id]:null, ['hanziReviews/'+id]:null}))
        .then(()=> logEvent('hanzi.delete', { testId:id, testTitle:a.title, ownerUid:a.ownerUid, ownerName:a.ownerName, note:`${n} ta javob bilan korzinkaga` }))
        .then(()=> HZ.go('list'));
    }).catch(e=> alert("O'chirib bo'lmadi: "+e.message));
};

/* ---------------- 5.2 So'zlar bazasi ---------------- */
const HSK = [1,2,3,4,5,6,7,8,9];
H.wq = ''; H.whsk = 0; H.wmine = false;
function wordMatch(w, q){
  q = (q||'').trim().toLowerCase(); if(!q) return true;
  const plain = String(w.pinyin||'').toLowerCase().normalize('NFD').replace(/[^a-z]/g,'');
  const qp = q.replace(/[^a-z]/g,'');
  return (w.hanzi||'').includes(q) || String(w.pinyin||'').toLowerCase().includes(q) || (qp && plain.includes(qp)) ||
    String(w.translation||'').toLowerCase().includes(q) || (w.tags||[]).some(t=>String(t).toLowerCase().includes(q));
}
function wordKey(w){ return (w.hanzi||'').trim()+'|'+String(w.pinyin||'').toLowerCase().normalize('NFD').replace(/[^a-z]/g,''); }
function hskChips(cur, fn){
  return `<div style="margin-top:8px">${[0,...HSK].map(l=>`<span class="hz-chip ${cur===l?'on':''}" onclick="${fn}(${l})">${l?'HSK '+l:'Barchasi'}</span>`).join('')}</div>`;
}
function drawWords(){
  const all = Object.entries(H.words);
  const rows = all.filter(([,w])=> (!H.whsk || w.hsk===H.whsk) && (!H.wmine || w.ownerUid===me()) && wordMatch(w, H.wq))
    .sort((a,b)=>((a[1].hsk||99)-(b[1].hsk||99)) || String(a[1].pinyin).localeCompare(String(b[1].pinyin)));
  $('#hzBody').innerHTML = `
    <div class="card">
      <h2>📖 So'zlar bazasi</h2>
      <p class="muted">Barcha laoshilar uchun bitta umumiy baza: har kim istalgan so'zdan foydalanadi, tahrirlash/o'chirishni faqat so'z muallifi yoki administrator qiladi.
      Topshiriqqa so'zning <b>nusxasi</b> olinadi — keyin so'z o'zgarsa ham eski topshiriqlar buzilmaydi.</p>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-red btn-sm" onclick="HZ.wordForm()">➕ Yangi so'z</button>
        <button class="btn-ghost btn-sm" onclick="HZ.addStarter()">⭐ HSK 1 namuna so'zlari</button>
        <label class="btn-ghost btn-sm" style="margin:0;display:inline-block;border:1.5px solid var(--line);border-radius:7px;cursor:pointer;font-weight:600">📎 CSV import
          <input type="file" accept=".csv,text/csv" style="display:none" onchange="HZ.importWords(this)"></label>
        <button class="btn-ghost btn-sm" onclick="HZ.exportWords()">⬇ CSV eksport</button>
        <button class="btn-ghost btn-sm" onclick="HZ.wordTemplate()">⬇ Namuna CSV</button>
      </div>
      <div id="hz-wmsg"></div>
      <div class="row" style="margin-top:4px">
        <div><label>Qidiruv</label><input id="hz-wq" value="${esc(H.wq)}" placeholder="汉字, pinyin yoki ma'no" oninput="HZ.setWq(this.value)"></div>
        <div style="flex:0 0 auto;min-width:0"><label class="hz-check" style="margin-top:38px"><input type="checkbox" ${H.wmine?'checked':''} onchange="HZ.setWmine(this.checked)"> Faqat meniki</label></div>
      </div>
      ${hskChips(H.whsk,'HZ.setWhsk')}
    </div>
    <div class="card">
      <p class="muted" style="margin-bottom:8px">${rows.length} / ${all.length} ta so'z</p>
      ${!H.wLoaded ? '<p class="muted">Yuklanmoqda…</p>' : !rows.length ? `<div class="empty"><span class="ico">📖</span>So'z topilmadi.</div>` :
      `<div class="tbl"><table><tr><th>Hanzi</th><th>Pinyin</th><th>Tarjima</th><th>HSK</th><th>Muallif</th><th></th></tr>
      ${rows.map(([id,w])=>{
        const can = isAdmin() || w.ownerUid===me();
        return `<tr><td class="hz-han" style="font-size:24px">${esc(w.hanzi)}</td><td>${esc(w.pinyin)}</td>
          <td>${esc(w.translation)}${(w.altTranslations||[]).length?`<br><span class="muted">${esc(w.altTranslations.join('; '))}</span>`:''}</td>
          <td>${w.hsk?pill('p-blue','HSK '+w.hsk):'—'}</td><td class="muted">${esc(w.ownerName||'')}</td>
          <td style="white-space:nowrap"><button class="btn-ghost btn-sm" onclick="HZ.strokeAnim('${id}')">✍️ Tartib</button>
          ${can?`<button class="btn-ghost btn-sm" onclick="HZ.wordForm('${id}')">✏️</button><button class="btn-ghost btn-sm" onclick="HZ.delWord('${id}')">🗑</button>`:''}</td></tr>`;
      }).join('')}</table></div>`}
    </div>`;
}
HZ.setWq = v=>{ H.wq=v; const pos=$('#hz-wq').selectionStart; drawWords(); const el=$('#hz-wq'); el.focus(); el.setSelectionRange(pos,pos); };
HZ.setWhsk = l=>{ H.whsk=l; drawWords(); };
HZ.setWmine = v=>{ H.wmine=v; drawWords(); };
HZ.wordForm = (id, after)=>{
  const w = id ? H.words[id] : {};
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-bg" id="hz-wf" onclick="if(event.target===this)this.remove()"><div class="modal">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <h2 style="margin:0">${id?"✏️ So'zni tahrirlash":"➕ Yangi so'z"}</h2><button class="btn-ghost btn-sm" onclick="document.getElementById('hz-wf').remove()">✕</button></div>
    <div class="row">
      <div><label>Hanzi</label><input id="wf-h" class="hz-han" style="font-size:22px" lang="zh" value="${esc(w.hanzi||'')}" placeholder="你好"></div>
      <div><label>Pinyin</label><input id="wf-p" value="${esc(w.pinyin||'')}" placeholder="nǐ hǎo yoki ni3 hao3" onblur="this.value=HZ.toMarks(this.value)"></div>
    </div>
    <div class="row">
      <div><label>O'zbekcha tarjima</label><input id="wf-t" value="${esc(w.translation||'')}" placeholder="salom; assalomu alaykum"></div>
      <div style="flex:0 0 120px;min-width:100px"><label>HSK</label><select id="wf-k"><option value="">—</option>${HSK.map(l=>`<option value="${l}" ${w.hsk===l?'selected':''}>HSK ${l}</option>`).join('')}</select></div>
    </div>
    <label>Boshqa qabul qilinadigan tarjimalar <span class="muted" style="font-weight:400">(";" bilan)</span></label><input id="wf-at" value="${esc((w.altTranslations||[]).join('; '))}">
    <label>Boshqa qabul qilinadigan pinyin <span class="muted" style="font-weight:400">(";" bilan, kamdan-kam kerak)</span></label><input id="wf-ap" value="${esc((w.altPinyin||[]).join('; '))}">
    <label>Teglar <span class="muted" style="font-weight:400">(";" bilan, masalan: 3-dars)</span></label><input id="wf-g" value="${esc((w.tags||[]).join('; '))}">
    <div id="wf-err"></div>
    <div style="margin-top:14px"><button class="btn-red" onclick="HZ.saveWord('${id||''}')">💾 Saqlash</button></div>
  </div></div>`);
  H.wordAfter = after || null;
  $('#wf-h').focus();
};
const list = s => String(s||'').split(/[;|]/).map(x=>x.trim()).filter(Boolean);
function cleanWord(w){
  const hsk = +w.hsk;
  return { hanzi:String(w.hanzi||'').replace(/\s/g,''), pinyin:toMarks(String(w.pinyin||'').trim()), translation:String(w.translation||'').trim(),
    altTranslations: w.altTranslations||[], altPinyin: w.altPinyin||[], tags: w.tags||[], hsk: hsk>=1&&hsk<=9 ? hsk : null };
}
HZ.saveWord = id=>{
  const err = m=>{ $('#wf-err').innerHTML = m?`<div class="note red">${esc(m)}</div>`:''; };
  const w = cleanWord({ hanzi:$('#wf-h').value, pinyin:$('#wf-p').value, translation:$('#wf-t').value, hsk:$('#wf-k').value,
    altTranslations:list($('#wf-at').value), altPinyin:list($('#wf-ap').value), tags:list($('#wf-g').value) });
  if(!isHan(w.hanzi)) return err("Hanzi maydoniga faqat xitoycha ieroglif yozing.");
  if([...w.hanzi].length>16) return err("Juda uzun (16 belgigacha).");
  if(!w.pinyin) return err("Pinyin kiriting."); if(!w.translation) return err("Tarjima kiriting.");
  let job;
  if(id){ job = db.ref('hanziWords/'+id).update(w); }
  else {
    if(Object.values(H.words).some(x=>wordKey(x)===wordKey(w))) return err("Bu so'z (shu pinyin bilan) bazada allaqachon bor.");
    id = rnd(10);
    job = db.ref('hanziWords/'+id).set(Object.assign(w, {ownerUid:me(), ownerName:myName(), createdAt:Date.now()}));
  }
  job.then(()=>{ const m=document.getElementById('hz-wf'); if(m) m.remove(); if(H.wordAfter){ const f=H.wordAfter; H.wordAfter=null; f(id); } })
     .catch(e=> err("Saqlab bo'lmadi: "+e.message));
};
HZ.delWord = id=>{
  const w = H.words[id]; if(!w) return;
  if(!confirm(`"${w.hanzi}" so'zlar bazasidan o'chirilsinmi?\nMavjud topshiriqlardagi nusxasi saqlanib qoladi.`)) return;
  db.ref('hanziWords/'+id).remove().catch(e=> alert("O'chirib bo'lmadi: "+e.message));
};
function addWords(arr){
  const have = new Set(Object.values(H.words).map(wordKey)), up = {}; let n=0;
  arr.forEach(w=>{ w = cleanWord(w); const k=wordKey(w); if(!isHan(w.hanzi) || !w.pinyin || !w.translation || have.has(k)) return; have.add(k);
    up['hanziWords/'+rnd(10)] = Object.assign(w, {ownerUid:me(), ownerName:myName(), createdAt:Date.now()}); n++; });
  if(!n){ wmsg("Yangi so'z yo'q — hammasi bazada bor.", 'green'); return Promise.resolve(0); }
  return db.ref().update(up).then(()=>{ wmsg(`✅ ${n} ta so'z qo'shildi.`, 'green'); return n; }).catch(e=>{ wmsg("Qo'shib bo'lmadi: "+e.message); return 0; });
}
function wmsg(m,t){ const el=$('#hz-wmsg'); if(el) el.innerHTML = m?`<div class="note ${t||'red'}">${m}</div>`:''; }
const STARTER = [['你好','nǐ hǎo','salom'],['谢谢','xièxie','rahmat'],['再见','zàijiàn',"xayr; ko'rishguncha"],['对不起','duìbuqǐ','kechirasiz; uzr'],
  ['没关系','méi guānxi',"hechqisi yo'q"],['我','wǒ','men'],['你','nǐ','sen'],['他','tā','u (erkak)'],['她','tā','u (ayol)'],['我们','wǒmen','biz'],
  ['人','rén','odam; kishi'],['老师','lǎoshī',"o'qituvchi; ustoz"],['学生','xuésheng',"talaba; o'quvchi"],['朋友','péngyou',"do'st"],['爸爸','bàba','ota; dada'],
  ['妈妈','māma','ona; oyi'],['中国','Zhōngguó','Xitoy'],['汉语','Hànyǔ','xitoy tili'],['名字','míngzi','ism'],['什么','shénme','nima'],['谁','shéi','kim'],
  ['大','dà','katta'],['小','xiǎo','kichik'],['好','hǎo','yaxshi'],['水','shuǐ','suv'],['茶','chá','choy'],['米饭','mǐfàn','guruch (pishirilgan); guruch'],
  ['吃','chī','yemoq'],['喝','hē','ichmoq'],['看','kàn',"ko'rmoq; qaramoq"],['说','shuō','gapirmoq; aytmoq'],['学习','xuéxí',"o'qimoq; o'rganmoq"],
  ['喜欢','xǐhuan','yoqtirmoq'],['去','qù','bormoq'],['来','lái','kelmoq'],['家','jiā','uy; oila'],['书','shū','kitob'],['猫','māo','mushuk'],['狗','gǒu','it'],
  ['今天','jīntiān','bugun'],['明天','míngtiān','ertaga'],['昨天','zuótiān','kecha'],['一','yī','bir'],['二','èr','ikki'],['三','sān','uch'],['四','sì',"to'rt"],
  ['五','wǔ','besh'],['六','liù','olti'],['七','qī','yetti'],['八','bā','sakkiz'],['九','jiǔ',"to'qqiz"],['十','shí',"o'n"]];
HZ.addStarter = ()=> addWords(STARTER.map(([h,p,t])=>({hanzi:h,pinyin:p,translation:t,hsk:1,tags:['namuna']})));
const W_HEAD = ['hanzi','pinyin','translation','hsk','altTranslations','altPinyin','tags'];
HZ.wordTemplate = ()=> downloadFile('hanzi-sozlar-namuna.csv', '\uFEFF'+[W_HEAD, ['你好','ni3 hao3','salom','1','assalomu alaykum','','1-dars'], ['学习','xué xí',"o'qimoq; o'rganmoq",'1','','','']].map(r=>r.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
HZ.exportWords = ()=> downloadFile('hanzi-sozlar.csv', '\uFEFF'+[W_HEAD].concat(Object.values(H.words).map(w=>[w.hanzi,w.pinyin,w.translation,w.hsk||'',(w.altTranslations||[]).join('|'),(w.altPinyin||[]).join('|'),(w.tags||[]).join('|')])).map(r=>r.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
HZ.importWords = input=>{
  const f = input.files && input.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = ()=>{
    const raw = String(r.result||'').replace(/^\uFEFF/,'');
    const rows = parseCSV(raw, detectDelim(raw.split('\n')[0]||''));
    if(!rows.length) return wmsg('Fayl bo‘sh.');
    const head = rows[0].map(h=>String(h).trim().toLowerCase());
    const col = n=> head.indexOf(n.toLowerCase());
    if(col('hanzi')<0 || col('pinyin')<0 || col('translation')<0) return wmsg('Birinchi qatorda <b>hanzi, pinyin, translation</b> ustunlari bo‘lishi kerak. "⬇ Namuna CSV"ga qarang.');
    const errs = [], out = [];
    rows.slice(1).forEach((r,i)=>{
      const g = n=> col(n)>=0 ? String(r[col(n)]||'').trim() : '';
      const w = {hanzi:g('hanzi'), pinyin:g('pinyin'), translation:g('translation'), hsk:g('hsk'), altTranslations:list(g('altTranslations')), altPinyin:list(g('altPinyin')), tags:list(g('tags'))};
      if(!isHan(w.hanzi) || !w.pinyin || !w.translation){ errs.push(`${i+2}-qator: hanzi/pinyin/tarjima to‘liq emas`); return; }
      out.push(w);
    });
    addWords(out).then(()=>{ if(errs.length) wmsg(errs.slice(0,20).map(esc).join('<br>') + (errs.length>20?'<br>…':''), 'red'); });
    input.value = '';
  };
  r.readAsText(f, 'utf-8');
};

/* ---------------- 5.3 Guruhlar va o'quvchi kodlari ---------------- */
/* Kod — o'quvchining "paroli": 6 belgi. Bazada ochiq ko'rinishda faqat egasining guruh tugunida turadi;
   o'quvchilar uchun ochiq joyda (hanziRoster) faqat uning SHA-256 xeshi saqlanadi. */
async function sha(text){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
const codeHash = (gid, code)=> sha(gid+':'+String(code||'').trim().toUpperCase());
const newCode = ()=> Array.from({length:6},()=>CODE_ALPHA[Math.floor(Math.random()*CODE_ALPHA.length)]).join('');
HZ.codeHash = codeHash;

function drawGroups(){
  const ids = Object.keys(H.groups).sort((a,b)=>String(H.groups[a].name).localeCompare(String(H.groups[b].name)));
  $('#hzBody').innerHTML = `
    <div class="card">
      <h2>👥 Guruhlar va o'quvchi kodlari</h2>
      <p class="muted">Topshiriqni guruhga biriktirsangiz, o'quvchi uni <b>shaxsiy kodi</b> bilan ochadi — ro'yxatda bo'lmagan odam kira olmaydi.
      Guruhsiz topshiriqlar avvalgi testlar kabi <b>ism yozib</b> ochiladi.</p>
      <div class="row" style="margin-top:6px">
        <div><label>Yangi guruh nomi</label><input id="hz-gname" placeholder="Masalan: HSK1-A (dushanba)"></div>
        <div style="flex:0 0 auto"><label>&nbsp;</label><button class="btn-red" onclick="HZ.createGroup()">➕ Guruh yaratish</button></div>
      </div>
    </div>
    ${!H.gLoaded ? '<p class="muted">Yuklanmoqda…</p>' : !ids.length ? `<div class="card"><div class="empty"><span class="ico">👥</span>Hali guruh yo'q.</div></div>` :
      ids.map(gid=>{
        const g = H.groups[gid]; const st = Object.entries(g.students||{}).sort((a,b)=>String(a[1].name).localeCompare(String(b[1].name)));
        const portal = linkFor('?hg='+gid);
        return `<div class="card">
          <div class="lrow" style="border:none;padding:0;margin:0;background:transparent">
            <div class="lrow-main"><div class="lrow-title">${esc(g.name)} ${pill('p-gray', st.length+" o'quvchi")}
              ${isAdmin() && g._owner!==me() ? pill('p-gray', esc(g.ownerName||'')) : ''}</div></div>
            <div class="lrow-act">
              <button class="btn-ghost btn-sm" onclick="HZ.toggle('gp-${gid}')">🔗 Guruh portali (QR)</button>
              ${menuHtml('gm-'+gid, [
                {label:'🖨 Kodlar varag‘ini chop etish', fn:`HZ.printCodes('${gid}')`},
                {label:'⬇ Kodlar (CSV)', fn:`HZ.codesCsv('${gid}')`},
                {label:'✏️ Nomini o‘zgartirish', fn:`HZ.renameGroup('${gid}')`},
                {label:'🗑 Guruhni o‘chirish', fn:`HZ.delGroup('${gid}')`, danger:true}
              ])}
            </div></div>
          <div id="gp-${gid}" class="hidden" style="margin-top:12px">${qrBlock(portal, 'guruh-'+g.name, "Guruh portali: o'quvchi kodini kiritib, <b>faqat o'ziga berilgan</b> barcha Hanzi topshiriqlarini ko'radi.")}</div>
          <label>O'quvchilarni qo'shish <span class="muted" style="font-weight:400">(har qatorga bitta ism-familiya)</span></label>
          <textarea id="gs-${gid}" rows="3" style="font-family:var(--sans)" placeholder="Aziza Karimova&#10;Bobur Aliyev"></textarea>
          <div style="margin-top:8px"><button class="btn-p btn-sm" onclick="HZ.addStudents('${gid}')">➕ Qo'shish va kod berish</button></div>
          ${st.length ? `<div class="tbl" style="margin-top:12px"><table class="hz-codes"><tr><th>O'quvchi</th><th>Kod</th><th></th></tr>
            ${st.map(([sid,s])=>`<tr><td style="font-family:var(--sans)">${esc(s.name)}</td><td><b>${esc(s.code)}</b></td>
              <td style="white-space:nowrap;text-align:right"><button class="btn-ghost btn-sm" title="Yangi kod" onclick="HZ.newCode('${gid}','${sid}')">🔁</button>
              <button class="btn-ghost btn-sm" onclick="HZ.delStudent('${gid}','${sid}')">🗑</button></td></tr>`).join('')}</table></div>` : ''}
        </div>`;
      }).join('')}`;
}
HZ.toggle = id=>{ const el=document.getElementById(id); if(el) el.classList.toggle('hidden'); };
function groupPath(gid){ const g=H.groups[gid]; return 'hanziGroups/'+((g&&g._owner)||me())+'/'+gid; }
HZ.createGroup = ()=>{
  const name = $('#hz-gname').value.trim(); if(name.length<2) return alert('Guruh nomini kiriting');
  const gid = rnd(10);
  db.ref().update({ ['hanziGroups/'+me()+'/'+gid]: {name, ownerUid:me(), ownerName:myName(), createdAt:Date.now()},
                    ['hanziRoster/'+gid+'/_owner']: me() })
    .then(()=> logEvent('hanzi.group', { targetName:name, note:'guruh yaratildi' }))
    .catch(e=> alert('Yaratib bo‘lmadi: '+e.message));
};
HZ.renameGroup = gid=>{
  const g = H.groups[gid]; const name = prompt('Yangi nom:', g.name); if(!name || name.trim().length<2) return;
  db.ref(groupPath(gid)+'/name').set(name.trim());
};
HZ.addStudents = async gid=>{
  const g = H.groups[gid]; const names = $('#gs-'+gid).value.split('\n').map(s=>s.trim()).filter(s=>s.length>=2);
  if(!names.length) return alert("Kamida bitta ism kiriting");
  const used = new Set(Object.values(g.students||{}).map(s=>s.code)); const up = {};
  for(const name of names){
    let code; do { code = newCode(); } while(used.has(code)); used.add(code);
    const sid = rnd(10);
    up[groupPath(gid)+'/students/'+sid] = {name, code, addedAt:Date.now()};
    up['hanziRoster/'+gid+'/'+(await codeHash(gid, code))] = sid;
  }
  db.ref().update(up).then(()=> logEvent('hanzi.group', { targetName:g.name, note:`${names.length} ta o'quvchi qo'shildi` }))
    .catch(e=> alert("Qo'shib bo'lmadi: "+e.message));
};
HZ.newCode = async (gid, sid)=>{
  const g = H.groups[gid], s = g.students[sid];
  if(!confirm(`${s.name} uchun yangi kod berilsinmi? Eski kod (${s.code}) ishlamay qoladi.`)) return;
  const used = new Set(Object.values(g.students).map(x=>x.code)); let code; do { code=newCode(); } while(used.has(code));
  db.ref().update({ [groupPath(gid)+'/students/'+sid+'/code']: code,
    ['hanziRoster/'+gid+'/'+(await codeHash(gid, s.code))]: null,
    ['hanziRoster/'+gid+'/'+(await codeHash(gid, code))]: sid });
};
HZ.delStudent = async (gid, sid)=>{
  const g = H.groups[gid], s = g.students[sid];
  if(!confirm(`${s.name} guruhdan chiqarilsinmi? Uning kodi ishlamay qoladi (oldingi javoblari saqlanadi).`)) return;
  db.ref().update({ [groupPath(gid)+'/students/'+sid]: null, ['hanziRoster/'+gid+'/'+(await codeHash(gid, s.code))]: null });
};
HZ.delGroup = gid=>{
  const g = H.groups[gid];
  const used = Object.values(H.assignments).filter(a=>a.groupId===gid).length;
  if(!confirm(`"${g.name}" guruhi o'chirilsinmi?` + (used?`\n\nDiqqat: ${used} ta topshiriq shu guruhga biriktirilgan — kodlar ishlamay qoladi.`:''))) return;
  db.ref().update({ [groupPath(gid)]: null, ['hanziRoster/'+gid]: null })
    .then(()=> logEvent('hanzi.group', { targetName:g.name, note:'guruh o‘chirildi' }));
};
HZ.codesCsv = gid=>{
  const g = H.groups[gid];
  downloadFile(`kodlar-${g.name}.csv`.replace(/[^\p{L}\p{N}.-]+/gu,'-'), '\uFEFF'+[["O'quvchi",'Kod','Portal']].concat(Object.values(g.students||{}).map(s=>[s.name,s.code,linkFor('?hg='+gid)])).map(r=>r.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
};
HZ.printCodes = gid=>{
  const g = H.groups[gid]; const link = linkFor('?hg='+gid); let src=''; try{ src=qrPng(link, 300); }catch(e){}
  const el = document.createElement('div'); el.className='hz-print';
  el.innerHTML = `<div style="padding:20px;font-family:var(--sans)"><h2>${esc(g.name)} — Hanzi mashqlari kodlari</h2>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:12px">
    ${Object.values(g.students||{}).sort((a,b)=>String(a.name).localeCompare(String(b.name))).map(s=>`<div style="border:1px dashed #999;border-radius:8px;padding:10px;display:flex;gap:10px;align-items:center">
      ${src?`<img src="${src}" width="90" height="90">`:''}<div><b>${esc(s.name)}</b><br>Kod: <b style="font-family:monospace;font-size:20px">${esc(s.code)}</b><br><span style="font-size:11px">${esc(link)}</span></div></div>`).join('')}
    </div></div>`;
  document.body.appendChild(el); window.print(); setTimeout(()=>el.remove(), 500);
};

/* ---------------- 5.4 Topshiriq yaratish / tahrirlash ---------------- */
function itemFor(word, type){
  const chars = [...String(word.hanzi).replace(/\s/g,'')];
  const base = { type, wordId:word.id, charCount:chars.length, showHanzi:null, showPinyin:null, showTranslation:null, target:null };
  const key = { hanzi:word.hanzi, pinyin:word.pinyin, translation:word.translation, accepted:[word.hanzi] };
  if(type==='writing')     return {item:{...base, showPinyin:word.pinyin, showTranslation:word.translation, target:chars.join('')}, key};
  if(type==='hanzi_input') return {item:{...base, showPinyin:word.pinyin, showTranslation:word.translation}, key};
  if(type==='pinyin')      return {item:{...base, showHanzi:word.hanzi, showTranslation:word.translation}, key:{...key, accepted:[word.pinyin, ...(word.altPinyin||[])]}};
  if(type==='translation') return {item:{...base, showHanzi:word.hanzi, showPinyin:word.pinyin}, key:{...key, accepted:[word.translation, ...splitAlt(word.translation), ...(word.altTranslations||[])]}};
  return {item:{...base, target:word.hanzi}, key};   // dictation: matn ovozli o'qish uchun kerak
}
function drawEdit(){
  const id = H.editId, a = id ? H.assignments[id] : null;
  if(id && !a){ $('#hzBody').innerHTML = '<p class="muted">Topshiriq topilmadi.</p>'; return; }
  const locked = !!(a && a.status!=='draft');
  H.ed = H.ed && H.ed._for===(id||'new') ? H.ed : {
    _for: id||'new',
    words: a ? (a.wordIds||[]).slice() : [],
    types: a ? Object.keys(a.exerciseTypes||{}) : ['writing','pinyin','translation'],
    q:'', hsk:0
  };
  const dl = ms=>{ if(!ms) return ''; const d=new Date(ms), p=x=>String(x).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
  const gOpts = Object.entries(H.groups).sort((x,y)=>String(x[1].name).localeCompare(String(y[1].name)));
  const v = (k, d)=> a && a[k]!=null ? a[k] : d;
  $('#hzBody').innerHTML = `
  <div class="card">
    <h2>${id ? '✏️ Hanzi topshiriqni tahrirlash' : '➕ Yangi Hanzi topshiriq'} ${a?A_STATUS[a.status]:''}</h2>
    ${locked ? `<div class="note">Topshiriq e'lon qilingan: mavjud javoblar buzilmasligi uchun <b>so'zlar, mashq turlari va kim kirishi</b> qulflangan.
      Nomi, ko'rsatma, muddat, ball, urinishlar va maslahatlarni o'zgartirish mumkin.</div>` : ''}
    <label>Topshiriq nomi</label><input id="e-title" value="${esc(v('title',''))}" placeholder="Masalan: HSK 1 · 3-dars so'zlari">
    <label>Ko'rsatma <span class="muted" style="font-weight:400">(ixtiyoriy)</span></label><textarea id="e-instr" rows="2" style="font-family:var(--sans)">${esc(v('instructions',''))}</textarea>

    <h3 style="margin-top:20px">1. Kimga</h3>
    <label class="hz-check"><input type="radio" name="e-acc" value="open" ${v('access','open')==='open'?'checked':''} ${locked?'disabled':''} onchange="HZ.accChange()"> Havola/QR'ni olgan har kim — <b>ism-familiya yozib</b> kiradi (avvalgi testlar kabi)</label>
    <label class="hz-check"><input type="radio" name="e-acc" value="code" ${v('access','open')==='code'?'checked':''} ${locked?'disabled':''} onchange="HZ.accChange()"> Faqat guruh o'quvchilari — <b>shaxsiy kod</b> bilan kiradi</label>
    <div id="e-grp" class="${v('access','open')==='code'?'':'hidden'}" style="margin-top:6px">
      ${gOpts.length ? `<div class="row"><div><label>Guruh</label><select id="e-gid" ${locked?'disabled':''} onchange="HZ.drawAllowed()">${gOpts.map(([gid,g])=>`<option value="${gid}" ${v('groupId','')===gid?'selected':''}>${esc(g.name)} (${Object.keys(g.students||{}).length})</option>`).join('')}</select></div></div>
        <label class="hz-check"><input type="checkbox" id="e-pick" ${a&&a.allowed?'checked':''} ${locked?'disabled':''} onchange="HZ.drawAllowed()"> Faqat tanlangan o'quvchilarga</label>
        <div id="e-allowed"></div>`
      : `<div class="note">Hali guruh yo'q. "👥 Guruhlar va kodlar" bo'limida guruh yarating.</div>`}
    </div>

    <h3 style="margin-top:20px">2. So'zlar <span class="muted" style="font-weight:400" id="e-wc"></span></h3>
    <div id="e-sel" style="margin-top:6px"></div>
    ${locked ? '' : `<div class="row"><div><label>Bazadan qidirish</label><input id="hz-eq" value="${esc(H.ed.q)}" placeholder="汉字, pinyin, ma'no yoki teg" oninput="HZ.edQ(this.value)"></div>
      <div style="flex:0 0 auto"><label>&nbsp;</label><button class="btn-ghost" onclick="HZ.wordForm(null, HZ.edAddNew)">➕ Yangi so'z</button></div></div>
      <div id="e-hsk"></div>
      <div id="hz-pick" class="hz-wordpick" style="margin-top:8px"></div>`}

    <h3 style="margin-top:20px">3. Mashq turlari</h3>
    ${TYPES.map(t=>`<label class="hz-check"><input type="checkbox" class="e-type" value="${t}" ${H.ed.types.includes(t)?'checked':''} ${locked?'disabled':''} onchange="HZ.edTypes()"><span><b>${TYPE_LABEL[t]}</b><br><span class="muted">${TYPE_HELP[t]}</span></span></label>`).join('')}
    <p class="muted" style="margin-top:8px" id="e-ic"></p>

    <h3 style="margin-top:20px">4. Sozlamalar</h3>
    <div class="row">
      <div><label>Muddat <span class="muted" style="font-weight:400">(ixtiyoriy)</span></label><input id="e-due" type="datetime-local" value="${dl(v('dueAt',null))}"></div>
      <div><label>Maksimal ball</label><input id="e-max" type="number" min="1" value="${v('maxScore',10)}"></div>
      <div><label>Urinishlar soni</label><input id="e-att" type="number" min="1" max="20" value="${v('maxAttempts',2)}"></div>
    </div>
    <label class="hz-check"><input type="checkbox" id="e-late" ${v('allowLate',false)?'checked':''}> Muddatdan keyin ham topshirish mumkin (kechikkan deb belgilanadi)</label>
    <div class="row">
      <div><label>Yozish katagi</label><select id="e-grid" ${locked?'disabled':''}><option value="mi" ${v('gridType','mi')==='mi'?'selected':''}>米字格 (mi katak)</option><option value="tian" ${v('gridType','mi')==='tian'?'selected':''}>田字格 (tian katak)</option></select></div>
      <div><label>Har ieroglifda ruxsat etilgan chiziq xatosi</label><input id="e-tol" type="number" min="0" max="20" value="${v('tolerance',3)}" ${locked?'disabled':''}></div>
    </div>
    <label class="hz-check"><input type="checkbox" id="e-hints" ${v('allowHints',true)?'checked':''}> <span>Chiziq maslahatlari va tartib animatsiyasiga ruxsat <br><span class="muted">Kontur/animatsiya javobni ko'rsatadi — nazorat ishida o'chiring.</span></span></label>
    <label class="hz-check"><input type="checkbox" id="e-tones" ${v('requireTones',true)?'checked':''} ${locked?'disabled':''}> <span>Pinyinda tonlar majburiy <br><span class="muted">O'chirilsa, nǐ hǎo uchun "ni hao" ham to'g'ri hisoblanadi.</span></span></label>
    <label class="hz-check"><input type="checkbox" id="e-instant" ${v('instantCheck',false)?'checked':''} ${locked?'disabled':''}> <span>O'quvchi natijasini <b>darhol</b> ko'rsin (mashq rejimi) <br><span class="muted">Yoqilsa, to'g'ri javoblar o'quvchi brauzeriga yuboriladi (avvalgi testlardagi kabi). O'chiq bo'lsa, javoblar faqat sizda turadi va avtomatik natija siz topshiriqni ochganingizda hisoblanadi.</span></span></label>

    <div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn-red" onclick="HZ.saveA()">💾 ${id?"O'zgarishlarni saqlash":'Qoralama sifatida saqlash'}</button>
      <button class="btn-ghost" onclick="HZ.go(${id?`'detail','${id}'`:"'list'"})">Bekor qilish</button>
    </div>
    <div id="e-err"></div>
  </div>`;
  if(!locked){ $('#e-hsk').innerHTML = hskChips(H.ed.hsk,'HZ.edHsk'); drawPicker(); }
  drawSel(); HZ.drawAllowed(); HZ.edTypes();
}
HZ.accChange = ()=>{ const v=(document.querySelector('input[name="e-acc"]:checked')||{}).value; $('#e-grp').classList.toggle('hidden', v!=='code'); HZ.drawAllowed(); };
HZ.drawAllowed = ()=>{
  const el = $('#e-allowed'); if(!el) return;
  const gid = $('#e-gid') && $('#e-gid').value; const pick = $('#e-pick') && $('#e-pick').checked;
  const a = H.editId ? H.assignments[H.editId] : null; const allowed = (a && a.allowed) || {};
  if(!gid || !pick){ el.innerHTML=''; return; }
  const st = Object.entries((H.groups[gid]||{}).students||{}).sort((x,y)=>String(x[1].name).localeCompare(String(y[1].name)));
  const locked = !!(a && a.status!=='draft');
  el.innerHTML = !st.length ? `<p class="muted">Guruhda o'quvchi yo'q.</p>` :
    `<div class="hz-wordpick" style="max-height:200px">${st.map(([sid,s])=>`<label class="hz-check" style="margin:2px 4px"><input type="checkbox" class="e-stu" value="${sid}" ${allowed[sid]?'checked':''} ${locked?'disabled':''}> ${esc(s.name)}</label>`).join('')}</div>`;
};
function drawSel(){
  const el = $('#e-sel'); if(!el) return;
  const a = H.editId ? H.assignments[H.editId] : null; const locked = !!(a && a.status!=='draft');
  $('#e-wc').textContent = `(${H.ed.words.length}/${MAX_WORDS})`;
  const missing = H.ed.words.filter(w=>!H.words[w]).length;
  el.innerHTML = (!H.ed.words.length ? `<p class="muted">Hali so'z tanlanmagan — pastdan qidirib bosing.</p>` :
    H.ed.words.map((wid,i)=>{ const w = H.words[wid];
      return `<span class="hz-chip on">${w?`<b class="hz-han" style="font-size:18px">${esc(w.hanzi)}</b> ${esc(w.pinyin)}`:'<i>o‘chirilgan so‘z</i>'}
        ${locked?'':`<a onclick="HZ.edMove(${i},-1)" style="cursor:pointer">‹</a><a onclick="HZ.edMove(${i},1)" style="cursor:pointer">›</a><a onclick="HZ.edRm(${i})" style="cursor:pointer;color:var(--red)">✕</a>`}</span>`; }).join(''))
    + (missing && !locked ? `<div class="note">${missing} ta tanlangan so'z bazadan o'chirilgan — saqlashda tushib qoladi.</div>` : '');
  HZ.edTypes();
}
function drawPicker(){
  const el = $('#hz-pick'); if(!el || !H.ed) return;
  const rows = Object.entries(H.words).filter(([id,w])=> !H.ed.words.includes(id) && (!H.ed.hsk || w.hsk===H.ed.hsk) && wordMatch(w, H.ed.q))
    .sort((a,b)=>((a[1].hsk||99)-(b[1].hsk||99)) || String(a[1].pinyin).localeCompare(String(b[1].pinyin))).slice(0,120);
  el.innerHTML = !Object.keys(H.words).length ? `<p class="muted" style="padding:8px">So'zlar bazasi bo'sh. "➕ Yangi so'z" yoki "📖 So'zlar bazasi → ⭐ HSK 1 namuna so'zlari".</p>` :
    !rows.length ? `<p class="muted" style="padding:8px">Mos so'z yo'q.</p>` :
    rows.map(([id,w])=>`<button type="button" onclick="HZ.edAdd('${id}')"><span class="hz-han" style="font-size:20px;min-width:44px">${esc(w.hanzi)}</span><span class="muted">${esc(w.pinyin)}</span><span>${esc(w.translation)}</span>${w.hsk?pill('p-blue','HSK '+w.hsk):''}</button>`).join('');
}
HZ.edQ = q=>{ H.ed.q=q; drawPicker(); };
HZ.edHsk = l=>{ H.ed.hsk=l; $('#e-hsk').innerHTML = hskChips(l,'HZ.edHsk'); drawPicker(); };
HZ.edAdd = id=>{ if(H.ed.words.length>=MAX_WORDS) return alert(`Bitta topshiriqda ko'pi bilan ${MAX_WORDS} ta so'z.`); if(!H.ed.words.includes(id)) H.ed.words.push(id); drawSel(); drawPicker(); };
HZ.edAddNew = id=> HZ.edAdd(id);
HZ.edRm = i=>{ H.ed.words.splice(i,1); drawSel(); drawPicker(); };
HZ.edMove = (i,d)=>{ const j=i+d, w=H.ed.words; if(j<0||j>=w.length) return; [w[i],w[j]]=[w[j],w[i]]; drawSel(); };
HZ.edTypes = ()=>{ const el=$('#e-ic'); if(H.ed && document.querySelector('.e-type')) H.ed.types = [...document.querySelectorAll('.e-type:checked')].map(x=>x.value);
  if(el) el.textContent = `Jami savollar: ${H.ed.words.filter(w=>H.words[w]).length} so'z × ${H.ed.types.length} tur = ${H.ed.words.filter(w=>H.words[w]).length*H.ed.types.length}`; };

HZ.saveA = ()=>{
  const id = H.editId, old = id ? H.assignments[id] : null, locked = !!(old && old.status!=='draft');
  const err = m=>{ $('#e-err').innerHTML = m?`<div class="note red">${esc(m)}</div>`:''; if(m) $('#e-err').scrollIntoView({block:'center'}); };
  const title = $('#e-title').value.trim(); if(!title) return err('Topshiriq nomini kiriting');
  const dueAt = $('#e-due').value ? new Date($('#e-due').value).getTime() : null;
  const common = {
    title, instructions:$('#e-instr').value.trim(), dueAt, allowLate:$('#e-late').checked,
    maxScore:Math.max(1, +$('#e-max').value||10), maxAttempts:Math.max(1, Math.min(20, Math.round(+$('#e-att').value||1))),
    allowHints:$('#e-hints').checked, updatedAt:Date.now(), updatedByName:myName()
  };
  if(locked){
    return db.ref('hanziAssignments/'+id).update(common)
      .then(()=> logEvent('hanzi.edit', { testId:id, testTitle:title, ownerUid:old.ownerUid, ownerName:old.ownerName, note:'sozlamalar' }))
      .then(()=> HZ.go('detail', id)).catch(e=> err("Saqlab bo'lmadi: "+e.message));
  }
  const access = (document.querySelector('input[name="e-acc"]:checked')||{}).value || 'open';
  let groupId=null, groupName=null, allowed=null;
  if(access==='code'){
    groupId = $('#e-gid') && $('#e-gid').value; if(!groupId) return err('Guruhni tanlang (avval guruh yarating)');
    groupName = H.groups[groupId].name;
    if($('#e-pick').checked){ allowed = {}; document.querySelectorAll('.e-stu:checked').forEach(x=> allowed[x.value]=true);
      if(!Object.keys(allowed).length) return err("Kamida bitta o'quvchini tanlang"); }
  }
  const words = H.ed.words.filter(w=>H.words[w]).map(w=>Object.assign({id:w}, H.words[w]));
  const types = TYPES.filter(t=>H.ed.types.includes(t));
  if(!words.length) return err("Kamida bitta so'z tanlang");
  if(!types.length) return err('Kamida bitta mashq turini tanlang');
  const items = {}, keys = {}; let n = 0;
  types.forEach(t=> words.forEach(w=>{ const k='i'+String(n++).padStart(3,'0'); const b=itemFor(w,t); items[k]=b.item; keys[k]=b.key; }));
  const instant = $('#e-instant').checked;
  const aid = id || rnd(8);
  const rec = Object.assign({}, common, {
    access, groupId, groupName, allowed,
    exerciseTypes: Object.fromEntries(types.map(t=>[t,true])), wordIds: words.map(w=>w.id), itemCount:n, items,
    gridType:$('#e-grid').value, tolerance:Math.max(0, Math.round(+$('#e-tol').value||0)), requireTones:$('#e-tones').checked,
    instantCheck: instant, publicKeys: instant ? keys : null,
    status: old ? old.status : 'draft',
    ownerUid: old ? old.ownerUid : me(), ownerName: old ? old.ownerName : myName(),
    createdAt: old ? old.createdAt : Date.now(), publishedAt: old ? (old.publishedAt||null) : null
  });
  const up = { ['hanziAssignments/'+aid]: rec, ['hanziKeys/'+aid]: keys };
  db.ref().update(up)
    .then(()=> logEvent(id?'hanzi.edit':'hanzi.create', { testId:aid, testTitle:title, ownerUid:rec.ownerUid, ownerName:rec.ownerName, note:`${n} savol · ${access==='code'?'guruh: '+groupName:'ism bilan'}` }))
    .then(()=>{ H.ed = null; HZ.go('detail', aid); })
    .catch(e=> err("Saqlab bo'lmadi: "+e.message));
};

/* ---------------- 5.5 Topshiriq sahifasi: QR, o'quvchilar, avtomatik tekshiruv ---------------- */
function effStatus(s, r){
  if(!s) return 'not_started';
  const fresh = r && r.forSubmittedAt && r.forSubmittedAt === s.submittedAt;
  if(s.status==='submitted') return fresh && r.status ? r.status : 'submitted';
  if(r && r.status==='needs_revision' && r.forSubmittedAt === s.submittedAt) return 'needs_revision';
  return 'draft';
}
HZ.effStatus = effStatus;
function studentLabel(a, sid, s){
  if(s && s.name) return s.name;
  const g = a.groupId && H.groups[a.groupId];
  const stuId = (s && s.studentId) || (sid.startsWith('c_') ? sid.slice(2) : null);
  return (g && stuId && g.students && g.students[stuId] && g.students[stuId].name) || (s && s.name) || sid;
}
function finalScore(a, r){ return r && r.status==='reviewed' && r.teacherScore!=null ? r.teacherScore : null; }
function loadDetail(aid){
  if(H.detailFor === aid && H.detailRefs) return;
  if(H.detailRefs) H.detailRefs.forEach(r=>r.off());
  H.detailFor = aid; H.sess = {}; H.revs = {}; H.keys = null;
  const sRef = db.ref('hanziSessions/'+aid), rRef = db.ref('hanziReviews/'+aid), kRef = db.ref('hanziKeys/'+aid);
  sRef.on('value', s=>{ H.sess = s.val()||{}; autoCheck(aid); if(H.view==='detail') drawDetail(); if(H.view==='rv') drawReview(true); }, e=> onErr(e,'hanziSessions'));
  rRef.on('value', s=>{ H.revs = s.val()||{}; autoCheck(aid); if(H.view==='detail') drawDetail(); if(H.view==='rv') drawReview(true); }, e=> onErr(e,'hanziReviews'));
  kRef.on('value', s=>{ H.keys = s.val()||{}; autoCheck(aid); if(H.view==='detail') drawDetail(); }, e=> onErr(e,'hanziKeys'));
  H.detailRefs = [sRef, rRef, kRef];
}
/* Avtomatik tekshiruv laoshi brauzerida bajariladi (javob kalitlari faqat shu yerda o'qiladi). */
const autoBusy = {};
function autoCheck(aid){
  const a = H.assignments[aid]; if(!a || !H.keys) return;
  Object.entries(H.sess).forEach(([sid,s])=>{
    if(s.status!=='submitted' || !s.submittedAt) return;
    const r = H.revs[sid]; if(r && r.autoResult && r.autoResult.forSubmittedAt===s.submittedAt) return;
    const tag = aid+sid+s.submittedAt; if(autoBusy[tag]) return; autoBusy[tag] = true;
    const res = grade(a, H.keys, s.answers||{});
    db.ref(`hanziReviews/${aid}/${sid}/autoResult`).set(Object.assign(res, {checkedAt:Date.now(), forSubmittedAt:s.submittedAt}))
      .catch(e=>{ delete autoBusy[tag]; console.warn('autoCheck', e); });
  });
}
function drawDetail(){
  const aid = H.cur, a = H.assignments[aid];
  if(!a){ $('#hzBody').innerHTML = `<div class="card"><p class="muted">${H.aLoaded?'Topshiriq topilmadi.':'Yuklanmoqda…'}</p></div>`; return; }
  loadDetail(aid);
  const link = linkFor('?hz='+aid);
  const g = a.groupId ? H.groups[a.groupId] : null;
  // o'quvchilar: kod rejimida — ro'yxatdagilar (boshlamaganlar ham), ochiq rejimda — kirganlar
  const rows = [];
  if(a.access==='code' && g){
    Object.entries(g.students||{}).forEach(([stuId,st])=>{ if(a.allowed && !a.allowed[stuId]) return;
      const sid='c_'+stuId; rows.push({sid, name:st.name, s:H.sess[sid], r:H.revs[sid]}); });
  }
  Object.entries(H.sess).forEach(([sid,s])=>{ if(!rows.some(x=>x.sid===sid)) rows.push({sid, name:studentLabel(a,sid,s), s, r:H.revs[sid]}); });
  rows.sort((x,y)=>String(x.name).localeCompare(String(y.name)));
  const cnt = k=> rows.filter(x=>effStatus(x.s,x.r)===k).length;
  const sent = rows.filter(x=>x.s && x.s.submittedAt).length;
  $('#hzBody').innerHTML = `
  <div class="card">
    <a class="muted" style="cursor:pointer" onclick="HZ.go('list')">← Topshiriqlar</a>
    <div class="lrow" style="border:none;padding:0;margin:6px 0 0;background:transparent">
      <div class="lrow-main"><div class="lrow-title" style="font-size:20px">${esc(a.title)} ${A_STATUS[a.status]||''}</div>
        <div class="lrow-sub">${a.itemCount} savol · ${Object.keys(a.exerciseTypes||{}).map(t=>TYPE_LABEL[t]).join(', ')}</div>
        <div class="lrow-sub">${a.dueAt?'Muddat: <b>'+fmtDT(a.dueAt)+'</b>'+(a.allowLate?' (kechikib topshirish mumkin)':''):'Muddatsiz'} · ${a.maxScore} ball · ${a.maxAttempts} urinish ·
          ${a.access==='code'?'🔑 '+esc(a.groupName||'')+(a.allowed?' (tanlanganlar)':''):'ism bilan kirish'} ${a.instantCheck?'· natija darhol':''}</div>
        ${a.instructions?`<p style="margin-top:6px">${esc(a.instructions)}</p>`:''}</div>
      <div class="lrow-act">
        ${a.status==='draft'?`<button class="btn-red btn-sm" onclick="HZ.publish('${aid}')">📣 E'lon qilish</button>`:''}
        <button class="btn-ghost btn-sm" onclick="HZ.exportA('${aid}')">⬇ Excel</button>
        ${menuHtml('hzd-'+aid, [
          {label:'✏️ Tahrirlash', fn:`HZ.go('edit','${aid}')`},
          a.status==='published' && {label:'🔒 Yakunlash', fn:`HZ.setStatus('${aid}','closed')`},
          a.status==='closed' && {label:'🔓 Qayta ochish', fn:`HZ.setStatus('${aid}','published')`},
          {label:'📋 Savollar va javoblar', fn:`HZ.toggle('hz-items')`},
          {label:'🗑 Korzinkaga', fn:`HZ.del('${aid}')`, danger:true}
        ])}
      </div></div>
  </div>
  ${a.status==='draft' ? `<div class="note">Bu qoralama — o'quvchilar hali ocha olmaydi. <b>📣 E'lon qilish</b>dan keyin havola va QR ishlaydi.</div>` :
    `<div class="card"><h2>📱 O'quvchilar uchun havola va QR</h2>${qrBlock(link, a.title,
      a.access==='code' ? "O'quvchi QR'ni telefon kamerasi bilan skanerlaydi va <b>shaxsiy kodini</b> kiritadi. Ro'yxatda bo'lmagan odam ocha olmaydi."
                        : "O'quvchi QR'ni skanerlaydi va ism-familiyasini yozib boshlaydi.")}</div>`}
  <div class="stats">
    <div class="stat"><b>${rows.length}</b><span>${a.access==='code'?"Ro'yxatda":'Kirganlar'}</span></div>
    <div class="stat"><b>${sent}</b><span>Yuborgan</span></div>
    <div class="stat"><b style="color:var(--amber)">${cnt('submitted')+cnt('in_review')}</b><span>Tekshirilmagan</span></div>
    <div class="stat"><b style="color:var(--jade)">${cnt('reviewed')}</b><span>Tekshirildi</span></div>
  </div>
  <div class="card"><h2>👥 O'quvchilar</h2>
    ${!rows.length ? `<p class="muted">${a.access==='code'?"Guruhda o'quvchi yo'q.":"Hali hech kim kirmadi. Havolani/QR'ni o'quvchilarga bering."}</p>` :
    `<div class="tbl"><table><tr><th>O'quvchi</th><th>Holat</th><th>Urinish</th><th>Avtomatik</th><th>Laoshi bahosi</th><th>Yuborilgan</th><th></th></tr>
    ${rows.map(x=>{ const st=effStatus(x.s,x.r), S=STATUS[st]; const ar = x.r && x.r.autoResult && x.s && x.r.autoResult.forSubmittedAt===x.s.submittedAt ? x.r.autoResult : null;
      const late = x.s && x.s.submittedAt && a.dueAt && x.s.submittedAt > a.dueAt;
      return `<tr><td style="font-weight:600">${esc(x.name)}</td><td>${pill(S.p,S.t)}${late?' '+pill('p-yellow','kechikkan'):''}</td>
        <td>${x.s?(x.s.attemptsUsed||0):0}/${a.maxAttempts}</td>
        <td>${ar?`${ar.score}/${ar.maxScore} <span class="muted">(${ar.correct}/${ar.total})</span>`:'<span class="muted">—</span>'}</td>
        <td><b>${finalScore(a,x.r)!=null?finalScore(a,x.r)+'/'+a.maxScore:'—'}</b></td>
        <td class="muted" style="white-space:nowrap">${x.s&&x.s.submittedAt?fmtDT(x.s.submittedAt):'—'}</td>
        <td style="white-space:nowrap">${x.s && x.s.submittedAt ? `<button class="btn-jade btn-sm" onclick="HZ.go('rv','${aid}','${x.sid}')">${st==='reviewed'?'Ko‘rish':'Tekshirish'}</button>` : ''}
          ${x.s ? `<button class="btn-ghost btn-sm" title="Natijani korzinkaga" onclick="HZ.delSess('${aid}','${x.sid}')">🗑</button>` : ''}</td></tr>`; }).join('')}</table></div>`}
  </div>
  <div id="hz-items" class="card hidden"><h2>📋 Savollar va to'g'ri javoblar</h2>
    ${!H.keys ? '<p class="muted">Yuklanmoqda…</p>' : itemKeys(a.items).map((k,i)=>{ const it=a.items[k], key=H.keys[k]||{};
      return `<div class="q-card" style="padding:10px 14px;margin-bottom:8px"><span class="q-num">${i+1}.</span> ${TYPE_LABEL[it.type]} — <span class="hz-han" style="font-size:20px">${esc(key.hanzi||'')}</span> · ${esc(key.pinyin||'')} · ${esc(key.translation||'')}
        ${it.type==='pinyin'||it.type==='translation'?`<br><span class="muted">Qabul qilinadi: ${esc((key.accepted||[]).join(' | '))}</span>`:''}</div>`; }).join('')}
  </div>`;
}
HZ.delSess = (aid, sid)=>{
  const a = H.assignments[aid], s = H.sess[sid]; if(!s) return;
  const name = studentLabel(a, sid, s);
  if(!confirm(`${name} ning javoblari korzinkaga o'tkazilsinmi? (O'quvchi topshiriqni boshidan boshlay oladi.)`)) return;
  trashPut('hanziSession', a.ownerUid, name, {session:s, review:H.revs[sid]||null}, {testId:aid, sessionId:sid, testTitle:a.title, note:'Hanzi · '+a.title})
    .then(()=> db.ref().update({[`hanziSessions/${aid}/${sid}`]:null, [`hanziReviews/${aid}/${sid}`]:null}))
    .then(()=> logEvent('hanzi.sessDelete', { testId:aid, testTitle:a.title, studentName:name, ownerUid:a.ownerUid, ownerName:a.ownerName }))
    .catch(e=> alert("O'chirib bo'lmadi: "+e.message));
};
HZ.exportA = aid=>{
  const a = H.assignments[aid];
  const rows = Object.entries(H.sess).map(([sid,s])=>({sid,s,r:H.revs[sid]}));
  if(a.access==='code' && H.groups[a.groupId]) Object.keys(H.groups[a.groupId].students||{}).forEach(stuId=>{ if(a.allowed&&!a.allowed[stuId]) return; if(!H.sess['c_'+stuId]) rows.push({sid:'c_'+stuId,s:null,r:null}); });
  const data = [['Topshiriq:', a.title], ['Laoshi:', a.ownerName||''], ['Maksimal ball:', a.maxScore], [],
    ['№',"O'quvchi",'Holat','Urinish','Avtomatik ball',"To'g'ri / jami",'Laoshi bahosi','Yuborilgan','Kechikkan','Izoh']]
    .concat(rows.map(x=>({...x, name:studentLabel(a,x.sid,x.s)})).sort((p,q)=>String(p.name).localeCompare(String(q.name))).map((x,i)=>{
      const ar = x.r && x.r.autoResult && x.s && x.r.autoResult.forSubmittedAt===x.s.submittedAt ? x.r.autoResult : null;
      return [i+1, x.name, STATUS[effStatus(x.s,x.r)].t, x.s?(x.s.attemptsUsed||0):0, ar?ar.score:'', ar?`${ar.correct}/${ar.total}`:'',
        finalScore(a,x.r)??'', x.s&&x.s.submittedAt?fmtDT(x.s.submittedAt):'', x.s&&x.s.submittedAt&&a.dueAt&&x.s.submittedAt>a.dueAt?'ha':'', (x.r&&x.r.teacherFeedback)||''];
    }));
  if(window.XLSX){ const ws=XLSX.utils.aoa_to_sheet(data); ws['!cols']=[{wch:4},{wch:26},{wch:18},{wch:8},{wch:14},{wch:12},{wch:14},{wch:18},{wch:10},{wch:30}];
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Hanzi'); XLSX.writeFile(wb, a.title.replace(/[^\w\d]+/g,'_')+'_hanzi.xlsx'); }
  else downloadFile('hanzi.csv', '\uFEFF'+data.map(r=>r.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
};

/* ---------------- 5.6 Bitta ishni tekshirish ---------------- */
function promptHtml(it){
  return `${it.showHanzi?`<span class="hz-han hz-big">${esc(it.showHanzi)}</span> `:''}${it.showPinyin?`<span style="font-size:18px">${esc(it.showPinyin)}</span> `:''}${it.showTranslation?`<span class="muted">«${esc(it.showTranslation)}»</span>`:''}${it.type==='dictation'?'<span class="muted">Tinglang va ieroglifda yozing</span>':''}`;
}
function answerHtml(it, ans, gridType, ghost){
  if(!ans || (!ans.text && !ans.freehand && !(ans.writing||[]).some(w=>w&&w.strokes))) return `<span class="muted">Javob yo'q</span>`;
  let h = '';
  if(ans.text) h += `<div>Javob: <b class="${it.type==='hanzi_input'||it.type==='dictation'?'hz-han':''}" style="font-size:${it.type==='hanzi_input'||it.type==='dictation'?22:16}px">${esc(ans.text)}</b></div>`;
  const w = (ans.writing||[]).filter(Boolean);
  if(w.length || ans.freehand){
    h += `<div style="display:flex;flex-wrap:wrap;margin-top:6px">` +
      w.map(c=> strokesSvg({ok:c.strokes, wrong:c.wrongStrokes}, 1024, gridType, 110, ghost?c.char:'', c.completed?`xatolar: ${c.mistakes||0}`:'tugallanmagan')).join('') +
      (ans.freehand ? strokesSvg({ok:ans.freehand}, 1000, gridType, 110, '', 'erkin yozuv') : '') + `</div>`;
  }
  return h;
}
function drawReview(fromSnapshot){
  const aid = H.cur, sid = H.rvSid, a = H.assignments[aid];
  if(!a){ $('#hzBody').innerHTML = '<p class="muted">Yuklanmoqda…</p>'; return; }
  loadDetail(aid);
  const s = H.sess[sid], r = H.revs[sid] || {};
  if(!s){ $('#hzBody').innerHTML = '<div class="card"><p class="muted">Yuklanmoqda…</p></div>'; return; }
  // Ochilishi bilan "tekshirilmoqda"
  if(s.status==='submitted' && effStatus(s,r)==='submitted' && !H.markBusy){
    H.markBusy = true;
    db.ref(`hanziReviews/${aid}/${sid}`).update({status:'in_review', forSubmittedAt:s.submittedAt}).finally(()=>{ H.markBusy=false; });
  }
  // Jonli yangilanishda (masalan avtomatik natija kelganda) laoshi yozib turgan qiymatlar saqlab qolinadi
  let keep = null;
  if(fromSnapshot && $('#rv-form') && H.rvFor===sid+s.submittedAt){
    keep = { score: $('#rv-score') && $('#rv-score').value, fb: $('#rv-fb') && $('#rv-fb').value, ov: Object.assign({}, H.rvOv), cm:{} };
    document.querySelectorAll('.rv-cm').forEach(el=> keep.cm[el.dataset.k] = el.value);
  }
  H.rvFor = sid+s.submittedAt;
  const fresh = r.forSubmittedAt===s.submittedAt;
  const ar = r.autoResult && r.autoResult.forSubmittedAt===s.submittedAt ? r.autoResult : null;
  const ov = fresh ? (r.itemOverrides||{}) : {}, cm = fresh ? (r.itemComments||{}) : {};
  H.rvOv = Object.assign({}, ov);
  const list = Object.entries(H.sess).filter(([,x])=>x.submittedAt).map(([k,x])=>({k,n:studentLabel(a,k,x)})).sort((p,q)=>String(p.n).localeCompare(String(q.n)));
  const pos = list.findIndex(x=>x.k===sid), prev = list[pos-1], next = list[pos+1];
  const name = studentLabel(a, sid, s), st = effStatus(s,r);
  $('#hzBody').innerHTML = `
  <div class="card" id="rv-form">
    <a class="muted" style="cursor:pointer" onclick="HZ.go('detail','${aid}')">← ${esc(a.title)}</a>
    <div class="lrow" style="border:none;padding:0;margin:6px 0 0;background:transparent">
      <div class="lrow-main"><div class="lrow-title" style="font-size:20px">${esc(name)} ${pill(STATUS[st].p, STATUS[st].t)}</div>
        <div class="lrow-sub">Yuborilgan: ${fmtDT(s.submittedAt)} · urinish ${s.attemptsUsed||1}/${a.maxAttempts}${a.dueAt&&s.submittedAt>a.dueAt?' · '+pill('p-yellow','kechikkan'):''}</div></div>
      <div class="lrow-act">${prev?`<button class="btn-ghost btn-sm" onclick="HZ.go('rv','${aid}','${prev.k}')">‹ ${esc(prev.n)}</button>`:''}${next?`<button class="btn-ghost btn-sm" onclick="HZ.go('rv','${aid}','${next.k}')">${esc(next.n)} ›</button>`:''}</div>
    </div>
  </div>
  ${!H.keys ? '<p class="muted">Javob kalitlari yuklanmoqda…</p>' : itemKeys(a.items).map((k,i)=>{
    const it=a.items[k], key=H.keys[k]||{}, v=ar?ar.verdicts[k]:null, fv = ov[k]||v||'unanswered';
    return `<div class="q-card hz-v-${fv}" id="rv-${k}">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div><span class="q-num">${i+1}.</span> ${promptHtml(it)}</div>
        <div>${pill('p-gray',TYPE_LABEL[it.type])} ${v?pill(VERDICT[v].p,'Avto: '+VERDICT[v].t):pill('p-gray','tekshirilmagan')}</div></div>
      <div class="muted" style="margin-top:6px">To'g'ri: <span class="hz-han" style="font-size:20px;color:var(--ink)">${esc(key.hanzi||'')}</span> · ${esc(key.pinyin||'')} · ${esc(key.translation||'')}</div>
      <div style="margin-top:6px">${answerHtml(it, (s.answers||{})[k], a.gridType, true)}</div>
      <div class="row" style="align-items:flex-end;margin-top:6px">
        <div style="flex:0 0 auto"><label>Sizning xulosangiz</label>
          <select class="rv-ov" data-k="${k}" onchange="HZ.rvOv('${k}',this.value)"><option value="">Avtomatik${v?' ('+VERDICT[v].t+')':''}</option>
          <option value="correct" ${ov[k]==='correct'?'selected':''}>To'g'ri</option><option value="incorrect" ${ov[k]==='incorrect'?'selected':''}>Noto'g'ri</option></select></div>
        <div><label>Izoh / tuzatish</label><input class="rv-cm" data-k="${k}" value="${esc(cm[k]||'')}" placeholder="masalan: 3-chiziq chapdan o'ngga"></div>
      </div></div>`; }).join('')}
  <div class="card hz-sticky" style="position:sticky;bottom:0">
    <p>Avtomatik: <b>${ar?`${ar.score}/${ar.maxScore} (${ar.correct}/${ar.total})`:'hisoblanmoqda…'}</b> ·
      Tuzatishlaringiz bilan: <b id="rv-sug">${scoreWithOverrides(a, ar?ar.verdicts:{}, H.rvOv)}</b>/${a.maxScore}
      <button class="btn-ghost btn-sm" onclick="document.getElementById('rv-score').value=document.getElementById('rv-sug').textContent">qo'llash</button></p>
    <div class="row">
      <div style="flex:0 0 140px;min-width:120px"><label>Yakuniy ball / ${a.maxScore}</label><input id="rv-score" type="number" step="0.5" min="0" max="${a.maxScore}" value="${fresh && r.teacherScore!=null ? r.teacherScore : ''}"></div>
      <div><label>Umumiy izoh</label><input id="rv-fb" value="${esc(fresh ? (r.teacherFeedback||'') : '')}" placeholder="Barakalla! / Yozuvga e'tibor bering"></div>
    </div>
    <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn-jade" onclick="HZ.saveRv('reviewed')">✅ Tekshirildi</button>
      <button class="btn-ghost" onclick="HZ.saveRv('needs_revision')">↩️ Qayta ishlashga qaytarish</button>
    </div><div id="rv-err"></div>
  </div>`;
  if(keep){
    $('#rv-score').value = keep.score; $('#rv-fb').value = keep.fb;
    document.querySelectorAll('.rv-cm').forEach(el=>{ if(keep.cm[el.dataset.k]!=null) el.value = keep.cm[el.dataset.k]; });
    document.querySelectorAll('.rv-ov').forEach(el=>{ el.value = keep.ov[el.dataset.k] || ''; HZ.rvOv(el.dataset.k, el.value); });
  }
}
HZ.rvOv = (k, v)=>{
  const a = H.assignments[H.cur], r = H.revs[H.rvSid]||{}, s = H.sess[H.rvSid];
  if(v) H.rvOv[k]=v; else delete H.rvOv[k];
  const ar = r.autoResult && r.autoResult.forSubmittedAt===s.submittedAt ? r.autoResult : null;
  const fv = H.rvOv[k] || (ar && ar.verdicts[k]) || 'unanswered';
  const el = document.getElementById('rv-'+k); if(el) el.className = 'q-card hz-v-'+fv;
  $('#rv-sug').textContent = scoreWithOverrides(a, ar?ar.verdicts:{}, H.rvOv);
};
HZ.saveRv = status=>{
  const aid=H.cur, sid=H.rvSid, a=H.assignments[aid], s=H.sess[sid], r=H.revs[sid]||{};
  const raw = $('#rv-score').value;
  if(status==='reviewed' && raw==='') return $('#rv-err').innerHTML = `<div class="note red">Yakuniy ballni kiriting (yoki "qo'llash" tugmasini bosing).</div>`;
  const score = raw==='' ? null : Math.max(0, Math.min(a.maxScore, +raw));
  const comments = {}; document.querySelectorAll('.rv-cm').forEach(el=>{ if(el.value.trim()) comments[el.dataset.k]=el.value.trim(); });
  const ar = r.autoResult && r.autoResult.forSubmittedAt===s.submittedAt ? r.autoResult : null;
  const finalWrong = itemKeys(a.items).filter(k=> (H.rvOv[k] || (ar&&ar.verdicts[k]) || 'unanswered') !== 'correct').map(k=> (H.keys[k]||{}).hanzi).filter(Boolean);
  db.ref(`hanziReviews/${aid}/${sid}`).update({
    status, teacherScore:score, teacherFeedback:$('#rv-fb').value.trim(), itemComments:comments, itemOverrides:H.rvOv,
    finalWrongWords:finalWrong, reviewedBy:me(), reviewedByName:myName(), reviewedAt:Date.now(), forSubmittedAt:s.submittedAt
  }).then(()=> logEvent(status==='reviewed'?'hanzi.review':'hanzi.revise', { testId:aid, testTitle:a.title, studentName:studentLabel(a,sid,s), ownerUid:a.ownerUid, ownerName:a.ownerName, note: score!=null?`${score}/${a.maxScore}`:'' }))
    .then(()=>{
      const list = Object.entries(H.sess).filter(([k,x])=>x.submittedAt && k!==sid && ['submitted','in_review'].includes(effStatus(x,H.revs[k]))).map(([k])=>k);
      if(list.length) HZ.go('rv', aid, list[0]); else HZ.go('detail', aid);
    }).catch(e=> $('#rv-err').innerHTML = `<div class="note red">Saqlab bo'lmadi: ${esc(e.message)}</div>`);
};

/* ---------------- 5.7 Tekshirish navbati (barcha topshiriqlar) ---------------- */
function loadAllSessions(){
  const ids = Object.keys(H.assignments).filter(id=>H.assignments[id].status!=='draft');
  return Promise.all(ids.map(id=> Promise.all([db.ref('hanziSessions/'+id).once('value'), db.ref('hanziReviews/'+id).once('value')])
      .then(([s,r])=>[id, s.val()||{}, r.val()||{}]).catch(()=>[id,{},{}])));
}
function drawQueue(){
  $('#hzBody').innerHTML = `<div class="card"><h2>✅ Tekshirishni kutayotgan ishlar</h2><div id="hz-q"><p class="muted">Yuklanmoqda…</p></div></div>`;
  loadAllSessions().then(all=>{
    const rows = [];
    all.forEach(([aid, ss, rs])=> Object.entries(ss).forEach(([sid,s])=>{ const st = effStatus(s, rs[sid]);
      if(st==='submitted'||st==='in_review') rows.push({aid, sid, s, st, ar: rs[sid]&&rs[sid].autoResult&&rs[sid].autoResult.forSubmittedAt===s.submittedAt?rs[sid].autoResult:null}); }));
    rows.sort((x,y)=>(x.s.submittedAt||0)-(y.s.submittedAt||0));
    const el = $('#hz-q'); if(!el) return;
    el.innerHTML = !rows.length ? `<div class="empty"><span class="ico">✅</span>Hammasi tekshirilgan.</div>` :
      rows.map(x=>{ const a=H.assignments[x.aid]; return `<div class="lrow"><div class="lrow-main">
        <div class="lrow-title">${esc(studentLabel(a,x.sid,x.s))} ${pill(STATUS[x.st].p, STATUS[x.st].t)}</div>
        <div class="lrow-sub">${esc(a.title)} · ${fmtDT(x.s.submittedAt)}${x.ar?` · avto: ${x.ar.score}/${x.ar.maxScore}`:''}</div></div>
        <div class="lrow-act"><button class="btn-jade btn-sm" onclick="HZ.go('rv','${x.aid}','${x.sid}')">Tekshirish</button></div></div>`; }).join('');
  });
}

/* ---------------- 5.8 Statistika ---------------- */
function drawStats(){
  $('#hzBody').innerHTML = `<div class="card"><h2>📈 Hanzi statistikasi</h2>
    <div class="row"><div><label>Guruh</label><select id="hs-g" onchange="HZ.statsDraw()"><option value="">Hammasi</option><option value="__open">Ism bilan (guruhsiz)</option>
      ${Object.entries(H.groups).map(([gid,g])=>`<option value="${gid}">${esc(g.name)}</option>`).join('')}</select></div>
      <div style="flex:0 0 auto"><label>&nbsp;</label><button class="btn-ghost" onclick="HZ.statsCsv()">⬇ CSV (Excel)</button></div></div></div>
    <div id="hz-st"><p class="muted">Yuklanmoqda…</p></div>`;
  loadAllSessions().then(all=>{ H.statAll = all; HZ.statsDraw(); });
}
function statsData(){
  const gsel = $('#hs-g') ? $('#hs-g').value : '';
  const perA = [], perS = {}, missed = {}; let expected=0, sent=0, unrev=0; const pct=[];
  (H.statAll||[]).forEach(([aid, ss, rs])=>{
    const a = H.assignments[aid]; if(!a) return;
    if(gsel==='__open' && a.access==='code') return;
    if(gsel && gsel!=='__open' && a.groupId!==gsel) return;
    const keys = new Set(Object.keys(ss));
    if(a.access==='code' && H.groups[a.groupId]) Object.keys(H.groups[a.groupId].students||{}).forEach(stu=>{ if(!a.allowed||a.allowed[stu]) keys.add('c_'+stu); });
    let aSent=0, aRev=0; const aPct=[];
    keys.forEach(sid=>{
      const s=ss[sid], r=rs[sid], st=effStatus(s,r); expected++;
      const name = studentLabel(a, sid, s), skey = a.access==='code' ? a.groupId+':'+sid : 'open:'+name.toLowerCase();
      const P = perS[skey] = perS[skey] || {name, group: a.access==='code'?(a.groupName||''):'—', assigned:0, sent:0, reviewed:0, pct:[]};
      P.assigned++;
      if(!s || !s.submittedAt) return;
      sent++; aSent++; P.sent++;
      if(st==='submitted'||st==='in_review') unrev++;
      if(st==='reviewed'){ aRev++; P.reviewed++; }
      const ar = r && r.autoResult && r.autoResult.forSubmittedAt===s.submittedAt ? r.autoResult : null;
      const sc = (r && r.status==='reviewed' && r.forSubmittedAt===s.submittedAt && r.teacherScore!=null) ? r.teacherScore : ar ? ar.score : null;
      if(sc!=null){ const p = sc/a.maxScore*100; pct.push(p); aPct.push(p); P.pct.push(p); }
      const ww = (r && r.status==='reviewed' && r.forSubmittedAt===s.submittedAt) ? (r.finalWrongWords||[]) : ar ? (ar.wrongWords||[]) : [];
      ww.forEach(w=> missed[w]=(missed[w]||0)+1);
    });
    perA.push({title:a.title, group: a.access==='code'?a.groupName:'ism bilan', expected:keys.size, sent:aSent, reviewed:aRev, avg:aPct.length?aPct.reduce((x,y)=>x+y,0)/aPct.length:null});
  });
  const avg = xs=> xs.length ? xs.reduce((x,y)=>x+y,0)/xs.length : null;
  return { perA, perS:Object.values(perS).map(p=>Object.assign(p,{avg:avg(p.pct)})).sort((x,y)=>(y.avg??-1)-(x.avg??-1)), missed:Object.entries(missed).sort((x,y)=>y[1]-x[1]).slice(0,15), expected, sent, unrev, avg:avg(pct) };
}
const P = x=> x==null ? '—' : Math.round(x)+'%';
HZ.statsDraw = ()=>{
  const d = statsData(), el = $('#hz-st'); if(!el) return;
  const mx = d.missed.length ? d.missed[0][1] : 1;
  el.innerHTML = `
  <div class="stats">
    <div class="stat"><b>${d.perA.length}</b><span>Topshiriqlar</span></div>
    <div class="stat"><b>${d.expected?Math.round(d.sent/d.expected*100):0}%</b><span>Bajarilish (${d.sent}/${d.expected})</span></div>
    <div class="stat"><b style="color:var(--amber)">${d.unrev}</b><span>Tekshirilmagan</span></div>
    <div class="stat"><b>${P(d.avg)}</b><span>O'rtacha ball</span></div>
  </div>
  <p class="muted" style="margin:-8px 0 12px">O'rtacha: laoshi bahosi bo'lsa shu, bo'lmasa avtomatik ball. Guruhsiz topshiriqlarda o'quvchilar ism bo'yicha birlashtiriladi.</p>
  <div class="grid2">
    <div class="card"><h2>❌ Eng ko'p xato qilingan so'zlar</h2>
      ${!d.missed.length?'<p class="muted">Hali ma\'lumot yo\'q.</p>':`<table>${d.missed.map(([w,n])=>`<tr><td class="hz-han" style="font-size:22px;width:70px">${esc(w)}</td><td><div class="bar"><i style="width:${Math.max(4,n/mx*100)}%"></i></div></td><td style="width:40px">${n}</td></tr>`).join('')}</table>`}</div>
    <div class="card"><h2>📚 Topshiriqlar bo'yicha</h2>
      ${!d.perA.length?'<p class="muted">E‘lon qilingan topshiriq yo‘q.</p>':`<div class="tbl"><table><tr><th>Topshiriq</th><th>Yuborgan</th><th>Tekshirildi</th><th>O'rtacha</th></tr>
      ${d.perA.map(x=>`<tr><td><b>${esc(x.title)}</b><br><span class="muted">${esc(x.group||'')}</span></td><td>${x.sent}/${x.expected}</td><td>${x.reviewed}</td><td>${P(x.avg)}</td></tr>`).join('')}</table></div>`}</div>
  </div>
  <div class="card"><h2>👥 O'quvchilar bo'yicha</h2>
    ${!d.perS.length?'<p class="muted">Ma‘lumot yo‘q.</p>':`<div class="tbl"><table><tr><th>O'quvchi</th><th>Guruh</th><th>Bajargan</th><th>Tekshirildi</th><th>O'rtacha</th></tr>
    ${d.perS.map(x=>`<tr><td><b>${esc(x.name)}</b></td><td class="muted">${esc(x.group)}</td><td>${x.sent}/${x.assigned}</td><td>${x.reviewed}</td><td>${P(x.avg)}</td></tr>`).join('')}</table></div>`}</div>`;
};
HZ.statsCsv = ()=>{
  const d = statsData();
  downloadFile('hanzi-statistika.csv', '\uFEFF'+[["O'quvchi",'Guruh','Berilgan','Yuborgan','Tekshirilgan',"O'rtacha %"]].concat(d.perS.map(x=>[x.name,x.group,x.assigned,x.sent,x.reviewed,x.avg==null?'':Math.round(x.avg)]))
    .concat([[],['Eng ko‘p xato qilingan so‘zlar'],...d.missed]).map(r=>r.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
};

/* ======================================================================
   6. O'QUVCHI TOMONI  (?hz=topshiriqId  yoki  ?hg=guruhId)
   ====================================================================== */
let ST = null;
const LS = (aid)=> 'hz_sid_'+aid;
const LSD = (aid, sid)=> 'hz_draft_'+aid+'_'+sid;
function lsGet(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
function lsSet(k,v){ try { localStorage.setItem(k,v); } catch(e){} }
function lsDel(k){ try { localStorage.removeItem(k); } catch(e){} }
function shell(inner, title, sub){
  app.innerHTML = `<div class="narrow" style="margin:0 auto">
    <div class="brand"><div class="seal">汉</div><div><h1>${esc(title||'Hanzi mashqlari')}</h1><small>${sub||'汉字练习'}</small></div></div>${inner}</div>`;
}
const msgCard = (ico, h, p)=> `<div class="card center"><div style="font-size:44px">${ico}</div><h2>${h}</h2><p class="muted">${p||''}</p></div>`;

HZ.studentEntry = aid=>{
  shell('<p class="muted">Yuklanmoqda…</p>');
  db.ref('hanziAssignments/'+aid).once('value').then(snap=>{
    const a = snap.val();
    if(!a) return shell(msgCard('❓','Topshiriq topilmadi',"Havolani laoshidan qayta so'rang."));
    if(a.status==='draft') return shell(msgCard('⏳',"Topshiriq hali e'lon qilinmagan","Laoshi e'lon qilgach shu havola ishlaydi."), a.title);
    const sid = lsGet(LS(aid));
    if(sid) return openSession(aid, a, sid, sid.startsWith('c_') ? {studentId:sid.slice(2)} : null);
    if(a.access==='code') return codeGate(aid, a);
    nameGate(aid, a);
  }).catch(e=> shell(msgCard('⚠️','Xatolik', esc(e.message)+'<br>Bu odatda Database Rules yangilanmaganini bildiradi.')));
};
function closedReason(a){
  if(a.status==='closed') return 'Laoshi bu topshiriqni yakunlagan.';
  if(a.dueAt && Date.now()>a.dueAt && !a.allowLate) return 'Topshirish muddati tugagan: '+fmtDT(a.dueAt)+'.';
  return null;
}
function nameGate(aid, a){
  const why = closedReason(a);
  if(why) return shell(msgCard('🔒','Topshiriq yopiq', why), a.title);
  shell(`<div class="card">
    <p class="muted">${a.itemCount} savol${a.dueAt?' · muddat: <b>'+fmtDT(a.dueAt)+'</b>':''}</p>
    ${a.instructions?`<p style="margin-top:8px">${esc(a.instructions)}</p>`:''}
    <label>Ism va familiyangiz</label><input id="hz-name" placeholder="Masalan: Aziza Karimova" onkeydown="if(event.key==='Enter')HZ.startByName('${aid}')">
    <div style="margin-top:14px"><button class="btn-red" style="width:100%" onclick="HZ.startByName('${aid}')">▶️ Boshlash</button></div></div>`, a.title);
  $('#hz-name').focus();
}
HZ.startByName = aid=>{
  const name = $('#hz-name').value.trim(); if(name.length<3) return alert("Ism-familiyangizni to'liq kiriting");
  const sid = rnd(12); lsSet(LS(aid), sid);
  db.ref('hanziAssignments/'+aid).once('value').then(s=> openSession(aid, s.val(), sid, {name}));
};
function codeGate(aid, a, err){
  shell(`<div class="card">
    <p class="muted">Bu topshiriq <b>${esc(a.groupName||'')}</b> guruhi uchun. Laoshingiz bergan shaxsiy kodni kiriting.</p>
    <label>O'quvchi kodi</label><input id="hz-code" placeholder="Masalan: K7M2QX" autocapitalize="characters" autocomplete="off" style="font-family:ui-monospace,monospace;font-size:20px;letter-spacing:.15em;text-transform:uppercase" onkeydown="if(event.key==='Enter')HZ.enterCode('${aid}')">
    ${err?`<div class="note red">${esc(err)}</div>`:''}
    <div style="margin-top:14px"><button class="btn-red" style="width:100%" onclick="HZ.enterCode('${aid}')">Kirish</button></div></div>`, a.title);
  $('#hz-code').focus();
}
function lookupCode(gid, code){
  return codeHash(gid, code).then(h=> db.ref('hanziRoster/'+gid+'/'+h).once('value')).then(s=> s.val());
}
HZ.enterCode = aid=>{
  const code = $('#hz-code').value.trim().toUpperCase(); if(code.length<4) return;
  db.ref('hanziAssignments/'+aid).once('value').then(snap=>{
    const a = snap.val();
    return lookupCode(a.groupId, code).then(stuId=>{
      if(!stuId) return codeGate(aid, a, "Kod noto'g'ri yoki bu guruhda yo'q.");
      if(a.allowed && !a.allowed[stuId]) return shell(msgCard('🚫',"Bu topshiriq sizga berilmagan","Laoshingizdan so'rang."), a.title);
      const sid = 'c_'+stuId; lsSet(LS(aid), sid); lsSet('hz_code_'+a.groupId, code);
      openSession(aid, a, sid, {studentId:stuId});
    });
  }).catch(e=> alert('Xatolik: '+e.message));
};
function openSession(aid, a, sid, init){
  Promise.all([ db.ref(`hanziSessions/${aid}/${sid}`).once('value'), db.ref(`hanziReviews/${aid}/${sid}`).once('value').catch(()=>null) ])
    .then(([s, r])=>{
      let sess = s.val();
      if(!sess && !init){ lsDel(LS(aid)); return HZ.studentEntry(aid); }
      ST = { aid, a, sid, sess: sess || null, rev: r ? r.val() : null, init: init||{} };
      // jonli: laoshi bahosi kelsa sahifa yangilanadi
      if(ST.revRef) ST.revRef.off();
      ST.revRef = db.ref(`hanziReviews/${aid}/${sid}`);
      ST.revRef.on('value', x=>{ const nv = x.val(); const ch = JSON.stringify(nv&&[nv.status,nv.teacherScore,nv.forSubmittedAt,nv.autoResult&&nv.autoResult.forSubmittedAt]) !== JSON.stringify(ST.rev&&[ST.rev.status,ST.rev.teacherScore,ST.rev.forSubmittedAt,ST.rev.autoResult&&ST.rev.autoResult.forSubmittedAt]);
        ST.rev = nv; if(ch && !ST.editing) renderWork(); }, ()=>{});
      const local = lsGet(LSD(aid, sid));
      ST.answers = (sess && sess.answers) || {};
      if(local){ try { const L = JSON.parse(local); if(L && L.at > ((sess && sess.savedAt)||0) + 1000 && canEdit()){ ST.answers = L.answers||{}; ST.restored = true; ST.dirty = true; } } catch(e){} }
      renderWork();
    }).catch(e=> shell(msgCard('⚠️','Xatolik', esc(e.message)+'<br>Bu odatda Database Rules yangilanmaganini bildiradi (README → Hanzi mashqlari).'), a.title));
}
function stStatus(){ return effStatus(ST.sess, ST.rev); }
function canEdit(){
  const a = ST.a, why = closedReason(a); if(why) return false;
  const st = stStatus();
  return st==='not_started' || st==='draft' || st==='needs_revision';
}
function attemptsLeft(){ return Math.max(0, ST.a.maxAttempts - ((ST.sess && ST.sess.attemptsUsed)||0)); }
function renderWork(){
  const a = ST.a, st = stStatus(), edit = canEdit(); ST.editing = edit;
  const rev = ST.rev, fresh = rev && ST.sess && rev.forSubmittedAt===ST.sess.submittedAt;
  const ar = rev && rev.autoResult && ST.sess && rev.autoResult.forSubmittedAt===ST.sess.submittedAt ? rev.autoResult : (ST.sess && ST.sess.instantResult && ST.sess.instantResult.forSubmittedAt===ST.sess.submittedAt ? ST.sess.instantResult : null);
  const verd = id=> (fresh && rev.itemOverrides && rev.itemOverrides[id]) || (ar && ar.verdicts && ar.verdicts[id]) || null;
  const why = closedReason(a);
  const left = attemptsLeft();
  const who = ST.sess && ST.sess.name ? ST.sess.name : ST.init.name || '';
  const S = STATUS[st];
  shell(`
    <div class="card" style="padding:14px 18px">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center">
        <div><b>${esc(who||'O‘quvchi')}</b> ${pill(S.p,S.t)}</div>
        <span class="muted">${a.dueAt?'Muddat: '+fmtDT(a.dueAt):'Muddatsiz'} · urinish: ${(ST.sess&&ST.sess.attemptsUsed)||0}/${a.maxAttempts}</span>
      </div>
      ${a.instructions?`<p style="margin-top:8px">${esc(a.instructions)}</p>`:''}
      ${why && st!=='reviewed' ? `<div class="note red">${esc(why)}</div>` : ''}
      ${ST.restored && edit ? `<div class="note">Bu qurilmada saqlangan, hali yuborilmagan javoblaringiz tiklandi.</div>` : ''}
      <div id="hz-net"></div>
    </div>
    ${fresh && (rev.status==='reviewed'||rev.status==='needs_revision') ? `<div class="note ${rev.status==='reviewed'?'green':'red'}">
      <b>${rev.status==='reviewed'?'✅ Laoshi tekshirdi':'↩️ Laoshi qayta ishlashni so‘radi'}</b>
      ${rev.teacherScore!=null?` — <b style="font-size:18px">${rev.teacherScore}/${a.maxScore}</b>`:''}
      ${rev.teacherFeedback?`<br>${esc(rev.teacherFeedback)}`:''}</div>` : ''}
    ${!edit && st==='submitted' || st==='in_review' ? `<div class="card center">
      ${ar ? `<div class="stamp ${ar.score/a.maxScore>=.71?'pass':''}"><b>${ar.score}</b><span>${ar.correct}/${ar.total}</span></div><p class="muted">Avtomatik natija. Yakuniy bahoni laoshi qo'yadi.</p>`
           : `<div style="font-size:40px">📤</div><h2>Yuborildi</h2><p class="muted">Natija laoshi tekshirgandan keyin shu sahifada chiqadi.</p>`}
      ${st==='submitted' && left>0 && !why ? `<button class="btn-jade" style="width:100%;margin-top:12px" onclick="HZ.retry()">🔄 Qayta urinish (${left} ta imkoniyat qoldi)</button>
        <p class="muted" style="margin-top:6px">Javobingiz qaytarib olinadi, uni yaxshilab qayta yuborasiz.</p>` : ''}</div>` : ''}
    <div id="hz-items"></div>
    ${edit ? `<div class="hz-sticky"><div style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap">
      <span class="muted" id="hz-prog"></span>
      <button class="btn-red" onclick="HZ.submit()" ${left<=0 && st!=='needs_revision'?'disabled':''}>📤 Yuborish</button></div></div>` : ''}
  `, a.title, a.itemCount+' savol · 汉字练习');
  const box = $('#hz-items');
  box.innerHTML = itemKeys(a.items).map((k,i)=>{
    const it = a.items[k], v = !edit ? verd(k) : null;
    const cmt = fresh && rev.itemComments && rev.itemComments[k];
    return `<div class="q-card ${v?'hz-v-'+v:''}">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><div><span class="q-num">${i+1}.</span> ${promptHtml(it)}</div>
        <div>${pill('p-gray',TYPE_LABEL[it.type])} ${v?pill(VERDICT[v].p, VERDICT[v].t):''}</div></div>
      <div style="margin-top:10px" id="hzi-${k}">${edit ? '' : answerHtml(it, ST.answers[k], a.gridType, false)}</div>
      ${cmt?`<div class="note" style="margin-top:8px"><b>Laoshi:</b> ${esc(cmt)}</div>`:''}</div>`;
  }).join('');
  if(edit){
    itemKeys(a.items).forEach(k=> mountInput(k));
    prefetchChars(itemKeys(a.items).filter(k=>a.items[k].type==='writing').flatMap(k=>[...(a.items[k].target||'')]));
    progress(); netBanner();
  }
}
function netBanner(){
  const el = $('#hz-net'); if(!el) return;
  el.innerHTML = navigator.onLine ? '' : `<div class="note">📴 Internet yo'q. Javoblaringiz shu qurilmada saqlanmoqda va aloqa tiklanganda yuboriladi.</div>`;
}
window.addEventListener('online', ()=>{ if(ST){ netBanner(); if(ST.dirty) flush(); } });
window.addEventListener('offline', ()=>{ if(ST) netBanner(); });
function padSize(){ return Math.max(130, Math.min(210, Math.floor((Math.min(window.innerWidth, 640) - 70)/2))); }
function mountInput(k){
  const it = ST.a.items[k], el = document.getElementById('hzi-'+k), ans = ST.answers[k] || {};
  const inp = (attrs, val, cls)=> `<input ${attrs} class="${cls||''}" value="${esc(val||'')}" oninput="HZ.setText('${k}',this.value)">`;
  if(it.type==='pinyin'){
    el.innerHTML = inp('placeholder="nǐ hǎo / ni3 hao3" autocapitalize="none" autocomplete="off" spellcheck="false"', ans.text) + `<div class="muted" id="pp-${k}" style="margin-top:4px"></div>`;
    pinyinPreview(k);
  } else if(it.type==='translation'){
    el.innerHTML = inp(`placeholder="O'zbekcha ma'nosi" autocomplete="off"`, ans.text);
  } else if(it.type==='hanzi_input' || it.type==='dictation'){
    el.innerHTML = (it.type==='dictation' ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
        <button class="btn-ghost btn-sm" onclick="HZ.speak(null,'${k}',0.8)">🔊 Tinglash</button><button class="btn-ghost btn-sm" onclick="HZ.speak(null,'${k}',0.45)">🐢 Sekinroq</button></div>
        ${hasZhVoice()?'':`<p class="muted" style="color:var(--amber)">Bu qurilmada xitoycha ovoz topilmadi — eshitilmasligi mumkin. Boshqa brauzer/telefonda urinib ko'ring.</p>`}` : '')
      + inp(`lang="zh-CN" autocomplete="off" placeholder="${'□'.repeat(Math.max(1,it.charCount||1))}" style="font-size:24px"`, ans.text, 'hz-han')
      + `<p class="muted" style="margin-top:4px">Xitoycha (pinyin) klaviaturadan foydalaning.</p>`;
  } else if(it.type==='writing'){
    mountWriting(k);
  }
}
function pinyinPreview(k){ const el=document.getElementById('pp-'+k); if(!el) return; const t=(ST.answers[k]||{}).text||''; const m=toMarks(t); el.textContent = m!==t ? '→ '+m : ''; }
HZ.setText = (k, v)=>{ setAns(k, {text:v}); if(ST.a.items[k].type==='pinyin') pinyinPreview(k); };
function setAns(k, patch){
  ST.answers[k] = Object.assign({text:'', writing:[], freehand:''}, ST.answers[k]||{}, patch);
  ST.dirty = true;
  lsSet(LSD(ST.aid, ST.sid), JSON.stringify({at:Date.now(), answers:ST.answers}));
  clearTimeout(ST.timer); ST.timer = setTimeout(flush, 2500);
  progress();
}
function progress(){
  const el = $('#hz-prog'); if(!el) return;
  const ids = itemKeys(ST.a.items);
  const done = ids.filter(k=>{ const a=ST.answers[k]; return a && ((a.text||'').trim() || a.freehand || (a.writing||[]).some(w=>w&&w.strokes)); }).length;
  el.textContent = `Javob berildi: ${done}/${ids.length}` + (ST.saveTxt ? ' · '+ST.saveTxt : '');
}
function baseSession(){
  return { name: ST.init.name || (ST.sess&&ST.sess.name) || '', studentId: ST.init.studentId || (ST.sess&&ST.sess.studentId) || null,
    groupId: ST.a.groupId || null, startedAt: (ST.sess&&ST.sess.startedAt) || Date.now(), attemptsUsed: (ST.sess&&ST.sess.attemptsUsed)||0, status:'draft' };
}
/* Saqlash: RTDB yozuvi internet yo'q paytda xotirada navbatga turadi; sahifa yopilsa ham
   localStorage'dagi nusxa tiklanadi. */
function flush(){
  if(!ST || !ST.dirty || !canEdit()) return;
  ST.dirty = false; clearTimeout(ST.timer);
  const ref = db.ref(`hanziSessions/${ST.aid}/${ST.sid}`);
  const data = { answers: ST.answers, savedAt: Date.now() };
  // "Qayta ishlash kerak" holatida tahrirlash boshlansa — topshirilgan ish qaytarib olinadi (laoshi yarim ishni ko'rmaydi)
  if(ST.sess && ST.sess.status==='submitted') data.status = 'draft';
  const job = ST.sess ? ref.update(data) : ref.set(Object.assign(baseSession(), data));
  if(!ST.sess) ST.sess = Object.assign(baseSession(), data);
  else Object.assign(ST.sess, data);
  ST.saveTxt = navigator.onLine ? 'saqlanmoqda…' : 'qurilmada saqlandi (oflayn)'; progress();
  job.then(()=>{ ST.saveTxt='saqlandi'; progress(); }).catch(e=>{ ST.dirty=true; ST.saveTxt='saqlanmadi: '+e.message; progress(); });
}
document.addEventListener('visibilitychange', ()=>{ if(document.hidden && ST) flush(); });
HZ.submit = ()=>{
  const ids = itemKeys(ST.a.items);
  const done = ids.filter(k=>{ const a=ST.answers[k]; return a && ((a.text||'').trim() || a.freehand || (a.writing||[]).some(w=>w&&w.strokes)); }).length;
  const st = stStatus(), left = attemptsLeft();
  if(left<=0 && st!=='needs_revision') return alert('Urinishlar tugagan.');
  if(!confirm(`${ids.length} tadan ${done} tasiga javob berdingiz. Yuborilsinmi?` + (done<ids.length?'\n(Javobsiz savollar noto‘g‘ri hisoblanadi.)':''))) return;
  clearTimeout(ST.timer); ST.dirty = false;
  const now = Date.now();
  const data = Object.assign(ST.sess ? {} : baseSession(), { answers:ST.answers, status:'submitted', submittedAt:now, savedAt:now, attemptsUsed: ((ST.sess&&ST.sess.attemptsUsed)||0)+1 });
  if(ST.a.instantCheck && ST.a.publicKeys){
    data.instantResult = Object.assign(grade(ST.a, ST.a.publicKeys, ST.answers), {forSubmittedAt:now});
  } else data.instantResult = null;
  const ref = db.ref(`hanziSessions/${ST.aid}/${ST.sid}`);
  const job = ST.sess ? ref.update(data) : ref.set(data);
  ST.sess = Object.assign(ST.sess||{}, data);
  let shown = false;
  const done2 = ok=>{ if(shown) return; shown = true; if(ok) lsDel(LSD(ST.aid, ST.sid)); renderWork(); };
  job.then(()=> done2(true)).catch(e=>{ alert("Yuborilmadi: "+e.message+"\nMuddat tugagan yoki urinishlar tugagan bo'lishi mumkin."); ST.sess.status='draft'; ST.sess.attemptsUsed--; ST.dirty=true; renderWork(); });
  setTimeout(()=>{ if(!shown){ alert("Internet yo'q — javobingiz aloqa tiklanishi bilan avtomatik yuboriladi. Sahifani yopmang."); done2(false); } }, 4000);
};
HZ.retry = ()=>{
  if(!confirm('Javobingiz qaytarib olinadi va yana tahrirlay olasiz. Davom etasizmi?')) return;
  db.ref(`hanziSessions/${ST.aid}/${ST.sid}`).update({status:'draft', instantResult:null, savedAt:Date.now()})
    .then(()=>{ ST.sess.status='draft'; ST.sess.instantResult=null; renderWork(); }).catch(e=> alert('Xatolik: '+e.message));
};

/* --------- yozish maydoni (HanziWriter + erkin chizish) --------- */
function mountWriting(k){
  const it = ST.a.items[k], el = document.getElementById('hzi-'+k), ans = ST.answers[k]||{};
  const free = ST.free && ST.free[k];
  const size = padSize();
  if(free){
    el.innerHTML = `<div class="hz-pad"><div class="hz-grid" style="width:${size}px;height:${size}px" id="fd-${k}">${gridSvg(ST.a.gridType)}
        <svg class="hz-draw" viewBox="0 0 1000 1000"><path d="${esc(ans.freehand||'')}" fill="none" stroke="#212A33" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/><path class="live" fill="none" stroke="#3D6B8E" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div class="hz-tools"><button class="btn-ghost btn-sm" onclick="HZ.fdUndo('${k}')">↶ Bekor qilish</button><button class="btn-ghost btn-sm" onclick="HZ.fdClear('${k}')">Tozalash</button></div></div>
      <p class="muted" style="margin-top:6px">Erkin yozuv avtomatik tekshirilmaydi — rasmni laoshi ko'rib baholaydi.</p>
      ${ST.hwFail&&ST.hwFail[k]?'':`<a style="cursor:pointer;font-size:13px;color:var(--blue)" onclick="HZ.wMode('${k}',false)">↩ Chiziq tekshiruviga qaytish</a>`}`;
    bindFree(k);
    return;
  }
  const chars = [...(it.target||'')];
  el.innerHTML = `<div class="hz-pads">${chars.map((c,i)=>`<div class="hz-pad"><div class="hz-grid" style="width:${size}px;height:${size}px">${gridSvg(ST.a.gridType)}<div class="hz-host" id="hw-${k}-${i}"></div><div class="hz-msg" id="hwm-${k}-${i}">Yuklanmoqda…</div></div>
      <div class="hz-tools" id="hwt-${k}-${i}"></div></div>`).join('')}</div>
    <a style="cursor:pointer;font-size:13px;color:var(--blue);display:inline-block;margin-top:6px" onclick="HZ.wMode('${k}',true)">✏️ Erkin yozishga o'tish</a>`;
  loadHW().then(HW=> chars.forEach((c,i)=> mountPad(HW, k, i, c, size))).catch(()=> fallbackFree(k));
}
function fallbackFree(k){ ST.free = ST.free||{}; ST.hwFail = ST.hwFail||{}; ST.free[k]=true; ST.hwFail[k]=true; mountWriting(k); }
HZ.wMode = (k, free)=>{ ST.free = ST.free||{}; ST.free[k]=free; mountWriting(k); };
function mountPad(HW, k, i, ch, size){
  const host = document.getElementById(`hw-${k}-${i}`); if(!host) return;
  const allow = !!ST.a.allowHints;
  const prev = ((ST.answers[k]||{}).writing||[])[i];
  const tools = document.getElementById(`hwt-${k}-${i}`);
  const writer = HW.create(host, ch, {
    width:size, height:size, padding:Math.round(size*.06), showCharacter:false, showOutline:allow,
    strokeColor:'#212A33', outlineColor:'#E3E1DA', drawingColor:'#3D6B8E', highlightColor:'#D08B0B', drawingWidth:Math.max(4,Math.round(size/18)),
    charDataLoader:(c,ok,err)=>{ loadChar(c).then(ok,err); },
    onLoadCharDataSuccess:()=>{ const m=document.getElementById(`hwm-${k}-${i}`); if(m) m.remove();
      if(prev && prev.completed){ writer.showCharacter(); setTools(true, prev.mistakes); } else start(false); },
    onLoadCharDataError:()=> fallbackFree(k)
  });
  function save(v){ const w = ((ST.answers[k]||{}).writing||[]).slice(); const chars=[...ST.a.items[k].target];
    for(let j=0;j<chars.length;j++) if(!w[j]) w[j] = {char:chars[j], completed:false, mistakes:0, strokes:'', wrongStrokes:''};
    w[i] = v; setAns(k, {writing:w}); }
  function setTools(done, mistakes){
    tools.innerHTML = (done ? `<span style="font-size:12px;font-weight:600;color:${mistakes?'var(--amber)':'var(--jade)'}">✓ xatolar: ${mistakes}</span>` : `<span class="muted" style="font-size:12px">Chiziqma-chiziq yozing</span>`)
      + `<button class="btn-ghost btn-sm" data-a="r">Qayta yozish</button>` + (allow ? `<button class="btn-ghost btn-sm" data-a="an">Tartibni ko'rsatish</button>` : '');
    tools.querySelector('[data-a="r"]').onclick = ()=>{ writer.cancelQuiz(); start(true); };
    const an = tools.querySelector('[data-a="an"]'); if(an) an.onclick = ()=>{ writer.cancelQuiz(); writer.animateCharacter({onComplete:()=> setTimeout(()=>start(true), 400)}); };
  }
  function start(reset){
    const acc = {ok:'', wrong:'', m:0};
    writer.hideCharacter(); if(allow) writer.showOutline(); else writer.hideOutline();
    setTools(false);
    const emit = done=> save({char:ch, completed:done, mistakes:acc.m, strokes:acc.ok, wrongStrokes:acc.wrong});
    if(reset) emit(false);
    writer.quiz({
      showHintAfterMisses: allow ? 3 : false,
      onCorrectStroke: d=>{ const p=ptsToPath(d.drawnPath && d.drawnPath.points); acc.ok = acc.ok ? acc.ok+' '+p : p; acc.m = d.totalMistakes||0; emit(false); },
      onMistake: d=>{ const p=ptsToPath(d.drawnPath && d.drawnPath.points); acc.wrong = acc.wrong ? acc.wrong+' '+p : p; acc.m = d.totalMistakes||0; emit(false); },
      onComplete: s=>{ acc.m = s.totalMistakes||0; emit(true); setTools(true, acc.m); }
    });
  }
}
function bindFree(k){
  const box = document.getElementById('fd-'+k); if(!box) return;
  const svg = box.querySelector('svg.hz-draw'), live = svg.querySelector('path.live');
  let cur = '', last = null, on = false;
  const pt = e=>{ const r=svg.getBoundingClientRect(); return {x:Math.max(0,Math.min(1000,(e.clientX-r.left)/r.width*1000)), y:Math.max(0,Math.min(1000,(e.clientY-r.top)/r.height*1000))}; };
  svg.onpointerdown = e=>{ e.preventDefault(); svg.setPointerCapture(e.pointerId); on=true; const p=pt(e); last=p; cur=`M${Math.round(p.x)} ${Math.round(p.y)}`; live.setAttribute('d',cur); };
  svg.onpointermove = e=>{ if(!on) return; const p=pt(e); if(last && Math.hypot(p.x-last.x,p.y-last.y)<6) return; last=p; cur+=` L${Math.round(p.x)} ${Math.round(p.y)}`; live.setAttribute('d',cur); };
  svg.onpointerup = svg.onpointercancel = ()=>{ if(!on) return; on=false; last=null; const s = cur.includes('L')?cur:cur+' l1 1'; cur='';
    live.setAttribute('d',''); const prev=(ST.answers[k]||{}).freehand||''; setAns(k,{freehand: prev?prev+' '+s:s}); svg.querySelector('path').setAttribute('d', ST.answers[k].freehand); };
}
HZ.fdUndo = k=>{ const p=((ST.answers[k]||{}).freehand||'').split(/(?=M)/).map(x=>x.trim()).filter(Boolean); p.pop(); setAns(k,{freehand:p.join(' ')}); mountWriting(k); };
HZ.fdClear = k=>{ setAns(k,{freehand:''}); mountWriting(k); };

/* --------- Guruh portali: kod bilan kirib, o'ziga berilgan topshiriqlarni ko'rish --------- */
HZ.groupPortal = (gid, err)=>{
  const saved = lsGet('hz_code_'+gid) || '';
  shell(`<div class="card">
    <p class="muted">Laoshingiz bergan shaxsiy kodni kiriting — sizga berilgan Hanzi topshiriqlari ko'rinadi.</p>
    <label>O'quvchi kodi</label><input id="hz-code" value="${esc(saved)}" autocomplete="off" style="font-family:ui-monospace,monospace;font-size:20px;letter-spacing:.15em;text-transform:uppercase" onkeydown="if(event.key==='Enter')HZ.portalGo('${gid}')">
    ${err?`<div class="note red">${esc(err)}</div>`:''}
    <div style="margin-top:14px"><button class="btn-red" style="width:100%" onclick="HZ.portalGo('${gid}')">Kirish</button></div></div>
    <div id="hz-plist"></div>`, 'Hanzi mashqlari', 'O‘quvchi portali · 汉字练习');
  if(saved) HZ.portalGo(gid);
};
HZ.portalGo = gid=>{
  const code = $('#hz-code').value.trim().toUpperCase(); if(code.length<4) return;
  lookupCode(gid, code).then(stuId=>{
    if(!stuId){ lsDel('hz_code_'+gid); return HZ.groupPortal(gid, "Kod noto'g'ri yoki bu guruhda yo'q."); }
    lsSet('hz_code_'+gid, code);
    return db.ref('hanziAssignments').orderByChild('groupId').equalTo(gid).once('value').then(snap=>{
      const all = Object.entries(snap.val()||{}).filter(([,a])=> a.status!=='draft' && (!a.allowed || a.allowed[stuId]))
        .sort((x,y)=> (x[1].status==='published'?0:1)-(y[1].status==='published'?0:1) || (x[1].dueAt||9e15)-(y[1].dueAt||9e15));
      const sid = 'c_'+stuId;
      return Promise.all(all.map(([aid])=> Promise.all([
        db.ref(`hanziSessions/${aid}/${sid}`).once('value').then(s=>s.val()).catch(()=>null),
        db.ref(`hanziReviews/${aid}/${sid}`).once('value').then(s=>s.val()).catch(()=>null)]))).then(st=>{
        const el = $('#hz-plist'); if(!el) return;
        el.innerHTML = !all.length ? `<div class="card"><div class="empty"><span class="ico">📭</span>Sizga hali topshiriq berilmagan.</div></div>` :
          `<div class="card"><h2>Sizning topshiriqlaringiz</h2>` + all.map(([aid,a],i)=>{ const [s,r]=st[i]; const es=effStatus(s,r), S=STATUS[es];
            const sc = r && r.status==='reviewed' && s && r.forSubmittedAt===s.submittedAt && r.teacherScore!=null ? ` · <b>${r.teacherScore}/${a.maxScore}</b>` : '';
            return `<div class="lrow"><div class="lrow-main"><div class="lrow-title">${esc(a.title)} ${pill(S.p,S.t)}</div>
              <div class="lrow-sub">${a.itemCount} savol · ${a.status==='closed'?'yopilgan':a.dueAt?'muddat: '+fmtDT(a.dueAt):'muddatsiz'}${sc}</div></div>
              <div class="lrow-act"><button class="btn-red btn-sm" onclick="HZ.portalOpen('${aid}','${sid}')">Ochish</button></div></div>`; }).join('') + `</div>`;
      });
    });
  }).catch(e=> HZ.groupPortal(gid, 'Xatolik: '+e.message));
};
HZ.portalOpen = (aid, sid)=>{ lsSet(LS(aid), sid); history.pushState(null,'','?hz='+aid); HZ.studentEntry(aid); };

/* ======================================================================
   7. ZAXIRA va KORZINKA uchun ilgaklar (index.html chaqiradi)
   ====================================================================== */
HZ.BACKUP_NODES = ['hanziWords','hanziAssignments','hanziGroups'];
HZ.backupExtra = async (data, progress)=>{
  const ids = Object.keys(data.hanziAssignments||{});
  for(const node of ['hanziKeys','hanziSessions','hanziReviews']){
    const out = {};
    for(let i=0;i<ids.length;i++){
      if(progress) progress(`Hanzi ${node}: ${i+1}/${ids.length}`);
      try { const v=(await db.ref(node+'/'+ids[i]).once('value')).val(); if(v) out[ids[i]]=v; } catch(e){}
    }
    if(Object.keys(out).length) data[node] = out;
  }
};
HZ.restoreExtra = async (d, put)=>{
  Object.entries(d.hanziWords||{}).forEach(([k,v])=> put('hanziWords/'+k, v));
  Object.entries(d.hanziAssignments||{}).forEach(([k,v])=> put('hanziAssignments/'+k, v));
  ['hanziKeys','hanziSessions','hanziReviews'].forEach(n=> Object.entries(d[n]||{}).forEach(([k,v])=> put(n+'/'+k, v)));
  for(const [owner, gs] of Object.entries(d.hanziGroups||{})){
    for(const [gid, g] of Object.entries(gs||{})){
      put('hanziGroups/'+owner+'/'+gid, g);
      put('hanziRoster/'+gid+'/_owner', owner);   // kod xeshlari guruhdan qayta hisoblanadi
      for(const [sid, s] of Object.entries(g.students||{})) put('hanziRoster/'+gid+'/'+(await codeHash(gid, s.code)), sid);
    }
  }
};
HZ.statsLine = d=>{ const n=o=>o?Object.keys(o).length:0; let s=0; Object.values(d.hanziSessions||{}).forEach(v=>s+=n(v));
  return `${n(d.hanziWords)} hanzi so'z · ${n(d.hanziAssignments)} hanzi topshiriq · ${s} hanzi javob`; };
HZ.restoreTrash = (r)=>{
  const p = r.payload||{};
  if(r.kind==='hanzi'){
    const up = {['hanziAssignments/'+r.testId]: p.assignment||null};
    if(p.keys) up['hanziKeys/'+r.testId]=p.keys; if(p.sessions) up['hanziSessions/'+r.testId]=p.sessions; if(p.reviews) up['hanziReviews/'+r.testId]=p.reviews;
    return { job: db.ref().update(up), ev:['hanzi.restore', { testId:r.testId, testTitle:r.title, ownerUid:r.ownerUid }] };
  }
  if(r.kind==='hanziSession'){
    const up = {[`hanziSessions/${r.testId}/${r.sessionId}`]: p.session||null};
    if(p.review) up[`hanziReviews/${r.testId}/${r.sessionId}`] = p.review;
    return { job: db.ref().update(up), ev:['hanzi.sessRestore', { testId:r.testId, testTitle:r.testTitle, studentName:r.title }] };
  }
  return null;
};
HZ.TRASH_KIND = { hanzi:'汉 Hanzi topshiriq', hanziSession:'汉 Hanzi javobi' };
HZ.LOG_LABELS = {
  'hanzi.create':'汉 Hanzi topshiriq yaratdi', 'hanzi.edit':'汉 Hanzi topshiriqni tahrirladi', 'hanzi.publish':'汉 Hanzi topshiriqni e‘lon qildi',
  'hanzi.close':'汉 Hanzi topshiriqni yakunladi', 'hanzi.open':'汉 Hanzi topshiriqni qayta ochdi', 'hanzi.delete':'汉 Hanzi topshiriqni o‘chirdi',
  'hanzi.restore':'汉 Hanzi topshiriqni tikladi', 'hanzi.review':'汉 Hanzi ishini baholadi', 'hanzi.revise':'汉 Hanzi ishini qayta ishlashga qaytardi',
  'hanzi.sessDelete':'汉 Hanzi javobini o‘chirdi', 'hanzi.sessRestore':'汉 Hanzi javobini tikladi', 'hanzi.group':'汉 Hanzi guruhi'
};
HZ.toMarks = toMarks;
// index.html'dagi jurnal/korzinka/zaxira ro'yxatlariga qo'shilish
if(typeof LOG_LABELS !== 'undefined') Object.assign(LOG_LABELS, HZ.LOG_LABELS);
if(typeof TRASH_KIND !== 'undefined') Object.assign(TRASH_KIND, HZ.TRASH_KIND);
if(typeof BACKUP_NODES !== 'undefined') HZ.BACKUP_NODES.forEach(n=>{ if(!BACKUP_NODES.includes(n)) BACKUP_NODES.push(n); });
})();
