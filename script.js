/* ============================================================
   STAFF LOBBY — isometric multiplayer (sampai 20 orang)
   Avatar tiap staff disimpan di Supabase (by nama). Tanpa login,
   diproteksi password room.
   ------------------------------------------------------------
   SETUP ONLINE: isi 4 baris di bawah, lalu deploy GitHub Pages.
   Kosong = DEMO mode (gate dilewati, ada NPC contoh).

   SQL Supabase (jalankan sekali di SQL Editor):
     create table profiles (
       name text primary key,
       avatar jsonb not null,
       updated_at timestamptz default now()
     );
     alter table profiles enable row level security;
     create policy "anon read"   on profiles for select using (true);
     create policy "anon insert" on profiles for insert with check (true);
     create policy "anon update" on profiles for update using (true) with check (true);
   ============================================================ */
const SUPABASE_URL      = "https://hnaylgaqriwtpzjhcwnf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuYXlsZ2Fxcml3dHB6amhjd25mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODkyNzAsImV4cCI6MjA5Mjk2NTI3MH0.GH5YFd4mVbhGUj_DiGVjqpZigcIM1AzjW7At6P1P9K4";
const ROOM_CODE         = "staff-lobby"; // sama buat semua staff
const ROOM_PASSWORD     = "aabb1122";   //
const MAX_PEOPLE        = 20;
/* ============================================================ */

// -- Color cache: eliminasi getComputedStyle dari render loop --
const C = {};
function cacheColors() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of ['bg','bg2','floor','floor2','wallL','wallR','rose','mint','sun','ink','cream'])
    C[k] = cs.getPropertyValue('--'+k).trim();
}
cacheColors();

// ---------- Rooms ----------
const ROOMS = {
  lobby: {
    name:'Staff Lobby', grid:{w:10,h:10},
    palette:{floor:'#f3dcc4',floor2:'#ecc9aa',wallL:'#caa6c9',wallR:'#b990ba'},
    windows:[{gy:3},{gy:6}],
    furniture:[
      {gx:4.5,gy:4.5,kind:'rug'},
      {gx:1,gy:1,kind:'plant'},{gx:8,gy:1,kind:'lamp'},
      {gx:4.5,gy:2,kind:'table'},{gx:8,gy:8,kind:'plant'},{gx:1,gy:8,kind:'table'},
    ],
    neighbors:{up:'gym',down:null,left:null,right:null},
  },
  gym: {
    name:'Gym', grid:{w:10,h:10},
    palette:{floor:'#d8dee8',floor2:'#c4cdda',wallL:'#8aa0b8',wallR:'#7890aa'},
    windows:[],
    furniture:[
      {gx:2,  gy:2,  kind:'treadmill'},{gx:6,  gy:2,  kind:'treadmill'},
      {gx:4.5,gy:4.5,kind:'yogamat'},
      {gx:1.5,gy:6,  kind:'bench'},{gx:7.5,gy:6,kind:'dumbbell'},
      {gx:1,  gy:8,  kind:'mirror'},{gx:8,  gy:8,kind:'cooler'},
    ],
    neighbors:{up:null,down:'lobby',left:null,right:null},
  },
};
let currentRoomId = 'lobby';
function getRoom()       { return ROOMS[currentRoomId]; }
function applyPalette(r) {
  C.floor=r.palette.floor; C.floor2=r.palette.floor2;
  C.wallL=r.palette.wallL; C.wallR=r.palette.wallR;
}

document.getElementById('roomTitle').innerHTML = getRoom().name.replace(/\n/g,'<br>');
const ONLINE = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

const cv = document.getElementById('room'); let ctx = cv.getContext('2d');

// ---------- Iso grid ----------
let GW=10, GH=10; const TW=64, TH=32;
let originX=0, originY=0, DPR=1;
function updateOrigin() {
  originX = innerWidth/2; originY = innerHeight/2 - (GW+GH)*TH/4 + 20;
}

// -- Offscreen canvas untuk floor+walls+windows (digambar ulang hanya saat resize) --
let bgCanvas = null;
function buildRoomBG() {
  applyPalette(getRoom());
  bgCanvas = document.createElement('canvas');
  bgCanvas.width  = innerWidth  * DPR;   // device-pixel size
  bgCanvas.height = innerHeight * DPR;
  const bCtx = bgCanvas.getContext('2d');
  bCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
  bCtx.imageSmoothingEnabled = false;
  // swap ctx sementara sehingga drawFloor + helpers menulis ke offscreen
  const saved = ctx; ctx = bCtx; drawFloor(); ctx = saved;
}

function resize() {
  DPR = Math.min(window.devicePixelRatio||1, 2);
  cv.width  = innerWidth  * DPR; cv.height = innerHeight * DPR;
  cv.style.width  = innerWidth  + 'px'; cv.style.height = innerHeight + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.imageSmoothingEnabled = false;
  updateOrigin();
  buildRoomBG();
}
addEventListener('resize', resize); resize();

function iso(gx,gy) { return {x: originX+(gx-gy)*TW/2, y: originY+(gx+gy)*TH/2}; }
function unIso(sx,sy) { const dx=sx-originX, dy=sy-originY;
  return {gx:(dy/(TH/2)+dx/(TW/2))/2, gy:(dy/(TH/2)-dx/(TW/2))/2}; }

// ---------- Palettes ----------
const SKINS  = ['#ffe0c2','#f3c39a','#d99a6c','#a86b43','#6e4326'];
const HAIRC  = ['#2b2640','#5a3a22','#caa14a','#b5453b','#e8e4dc','#7a5cff'];
const SHIRTS = ['#ff8fab','#7fb3ff','#8fd9b6','#ffd23f','#c79bff','#ff9f6e'];
const HAIR_STYLES = [['short','Pendek'],['long','Panjang'],['spiky','Jabrik'],['bald','Botak']];
const TOPS = [['plain','Polos'],['tee','Kaos'],['shirt','Kemeja'],['hoodie','Hoodie'],['dress','Dress'],['apron','Celemek']];
const ACCS = [['none','Tanpa'],['cap','Topi'],['glasses','Kacamata'],['headband','Bando'],['badge','Badge']];
const PRESETS = [
  ['Seragam', {top:'apron', shirt:'#8fd9b6', acc:'badge'}],
  ['Casual',        {top:'tee',   shirt:'#7fb3ff', acc:'none'}],
  ['Formal',        {top:'shirt', shirt:'#fff6ec', acc:'glasses'}],
];

// ---------- State ----------
let me = null;                 // {id,name,av,fx,fy,tx,ty,face,bubble,bubT}
const others = new Map();
const myId = 'u' + Math.random().toString(36).slice(2,9);
const parts = [];
let draft = { name:'', av:{skin:SKINS[0], hair:'short', hairColor:HAIRC[0], shirt:SHIRTS[0], top:'plain', acc:'none'} };

function newPlayer(o) { return Object.assign({fx:5,fy:8,tx:5,ty:8,face:1,bubble:'',bubT:0,posSet:false}, o); }
function safeSpawn() {
  const occ = new Set([...others.values()].map(o => `${Math.round(o.fx??5)},${Math.round(o.fy??5)}`));
  let fx, fy, tries = 0;
  do {
    fx = 1 + Math.floor(Math.random() * (GW-2));
    fy = 1 + Math.floor(Math.random() * (GH-2));
    tries++;
  } while (occ.has(`${fx},${fy}`) && tries < 40);
  return {fx, fy};
}

// ---------- Furniture ----------
const depthOf = (gx,gy) => gx+gy;

// ============================================================
//  SCREEN 1: GATE
// ============================================================
const gateEl    = document.getElementById('gate');
const builderEl = document.getElementById('builder');
function showGate() {
  if (!ONLINE) { gateEl.style.display='none'; openBuilder(); return; } // demo: skip
  gateEl.style.display = 'flex';
  document.getElementById('gateBtn').onclick = tryGate;
  document.getElementById('passIn').addEventListener('keydown', e => { if(e.key==='Enter') tryGate(); });
}
function tryGate() {
  const v = document.getElementById('passIn').value;
  if (v === ROOM_PASSWORD) { gateEl.style.display='none'; openBuilder(); }
  else document.getElementById('gateErr').textContent = 'Password salah';
}

// ============================================================
//  SCREEN 2: AVATAR BUILDER
// ============================================================
const pv = document.getElementById('pv'), pctx = pv.getContext('2d');
pctx.imageSmoothingEnabled = false;
function buildRow(id, arr, getVal, setVal) {
  const row = document.getElementById(id); row.innerHTML = '';
  arr.forEach(c => {
    const d = document.createElement('div'); d.className = 'sw'; d.style.background = c;
    d.onclick = () => { setVal(c); markSel(row,d); drawPreview(); };
    if (getVal() === c) d.classList.add('sel');
    row.appendChild(d);
  });
}
function markSel(row, el) { [...row.children].forEach(c => c.classList.remove('sel')); el.classList.add('sel'); }
// inject baris Baju / Aksesoris / Preset sekali (reuse class CSS yg ada)
function ensureExtraRows() {
  if (document.getElementById('rowTop')) return;
  const after = document.getElementById('rowShirt').closest('.opt');
  const mk = (label,id) => { const o=document.createElement('div'); o.className='opt';
    o.innerHTML = '<span>'+label+'</span><div class="row" id="'+id+'"></div>'; return o; };
  const rTop=mk('Baju','rowTop'), rAcc=mk('Aksesoris','rowAcc'), rPre=mk('Preset','rowPreset');
  after.after(rTop); rTop.after(rAcc); rAcc.after(rPre);
}
function buildBtnRow(id, arr, getVal, setVal) {
  const row = document.getElementById(id); row.innerHTML = '';
  arr.forEach(([k,label]) => {
    const b = document.createElement('div'); b.className='hs'+(getVal()===k?' sel':''); b.textContent=label;
    b.onclick = () => { setVal(k); [...row.children].forEach(c=>c.classList.remove('sel')); b.classList.add('sel'); drawPreview(); };
    row.appendChild(b);
  });
}
function buildPresetRow() {
  const row = document.getElementById('rowPreset'); row.innerHTML = '';
  PRESETS.forEach(([label,set]) => {
    const b = document.createElement('div'); b.className='hs'; b.textContent=label;
    b.onclick = () => { Object.assign(draft.av, set); buildAllRows(); };
    row.appendChild(b);
  });
}
function buildAllRows() {
  buildRow('rowSkin',      SKINS,  () => draft.av.skin,      v => draft.av.skin=v);
  buildRow('rowHairColor', HAIRC,  () => draft.av.hairColor, v => draft.av.hairColor=v);
  buildRow('rowShirt',     SHIRTS, () => draft.av.shirt,     v => draft.av.shirt=v);
  const rs = document.getElementById('rowHairStyle'); rs.innerHTML = '';
  HAIR_STYLES.forEach(([k,label]) => {
    const b = document.createElement('div'); b.className='hs'+(draft.av.hair===k?' sel':''); b.textContent=label;
    b.onclick = () => { draft.av.hair=k; [...rs.children].forEach(c=>c.classList.remove('sel')); b.classList.add('sel'); drawPreview(); };
    rs.appendChild(b);
  });
  buildBtnRow('rowTop', TOPS, () => draft.av.top||'plain', v => draft.av.top=v);
  buildBtnRow('rowAcc', ACCS, () => draft.av.acc||'none',  v => draft.av.acc=v);
  buildPresetRow();
  drawPreview();
}
function enableBackdropClose(on) {
  builderEl.onclick = on ? (e) => { if (e.target===builderEl) { builderEl.style.display='none'; builderEl.onclick=null; } } : null;
}
function openBuilder(mode) {
  mode = mode || 'create';
  builderEl.style.display = 'flex';
  ensureExtraRows();
  const ni = document.getElementById('nameIn2');
  const enterBtn = document.getElementById('enterBtn');
  const h2 = builderEl.querySelector('h2');
  if (mode === 'edit') {
    // mode Lemari: pakai avatar yg lagi dipakai, nama dikunci
    draft.name = me.name; draft.av = JSON.parse(JSON.stringify(me.av));
    ni.value = me.name; ni.readOnly = true; ni.onchange = null;
    document.getElementById('loadNote').textContent = '';
    if (h2) h2.textContent = 'GANTI BAJU';
    enterBtn.textContent = 'SIMPAN';
    enterBtn.onclick = applyCloset;
    enableBackdropClose(true);
  } else {
    try { const saved = JSON.parse(localStorage.getItem('lobbyAvatar')||'null');
      if (saved) { draft.name=saved.name||''; draft.av=Object.assign(draft.av,saved.av); } } catch(e) {}
    ni.value = draft.name; ni.readOnly = false;
    if (h2) h2.textContent = 'BIKIN AVATAR';
    enterBtn.textContent = 'MASUK ROOM';
    ni.onchange = async () => { draft.name = ni.value.trim();
      if (ONLINE && draft.name) await loadProfileByName(draft.name); };
    enterBtn.onclick = finishBuilder;
    enableBackdropClose(false);
  }
  buildAllRows();
}
// ganti baju saat udah di room → update avatar + sync live ke staff lain
function applyCloset() {
  me.av = JSON.parse(JSON.stringify(draft.av));
  localStorage.setItem('lobbyAvatar', JSON.stringify({name:me.name, av:me.av}));
  builderEl.style.display = 'none'; builderEl.onclick = null;
  if (ONLINE) { saveProfile(); if (channel && subscribed) channel.track({name:me.name, av:me.av, fx:me.fx, fy:me.fy}); }
}
async function loadProfileByName(name) {
  const note = document.getElementById('loadNote'); note.textContent = 'Cek avatar lama...';
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?name=eq.${encodeURIComponent(name)}&select=avatar`,
      {headers:{apikey:SUPABASE_ANON_KEY, Authorization:'Bearer '+SUPABASE_ANON_KEY}});
    const arr = await r.json();
    if (arr && arr[0] && arr[0].avatar) {
      draft.av = Object.assign(draft.av, arr[0].avatar);
      openRefreshRows(); note.textContent = 'Avatar lama ke-load ✔';
    } else note.textContent = 'Nama baru — bikin avatar baru';
  } catch(e) { note.textContent = ''; }
}
function openRefreshRows() { buildAllRows(); }
function drawPreview() {
  pctx.clearRect(0, 0, pv.width, pv.height);
  pctx.save(); pctx.translate(60, 128); pctx.scale(1.7, 1.7);
  drawChar(pctx, draft.av, 1); pctx.restore();
}
function finishBuilder() {
  const nm = (document.getElementById('nameIn2').value||'Staff').trim().slice(0,14);
  draft.name = nm;
  localStorage.setItem('lobbyAvatar', JSON.stringify({name:nm, av:draft.av}));
  const _sp = safeSpawn();
  me = newPlayer({id:myId, name:nm, av:JSON.parse(JSON.stringify(draft.av)),
    fx:_sp.fx, fy:_sp.fy, posSet:true});
  me.tx = me.fx; me.ty = me.fy;
  builderEl.style.display = 'none';
  if (ONLINE) initOnline(); else initDemo();
  requestAnimationFrame(loop);
}

// ============================================================
//  INPUT
// ============================================================
cv.addEventListener('pointerdown', e => {
  if (!me) return;
  const r = cv.getBoundingClientRect();
  const t = unIso(e.clientX-r.left, e.clientY-r.top);
  me.tx = Math.max(0, Math.min(GW-1, Math.round(t.gx)));
  me.ty = Math.max(0, Math.min(GH-1, Math.round(t.gy)));
});
const msgIn = document.getElementById('msg');
function send() {
  const t = msgIn.value.trim(); if (!t||!me) return; msgIn.value = '';
  say(me, t); addLog(me.name, t, true);
  if (ONLINE && channel && subscribed) channel.send({type:'broadcast',event:'chat',payload:{id:myId,name:me.name,text:t}});
  else demoReply(t);
}
document.getElementById('sendBtn').onclick = send;
msgIn.addEventListener('keydown', e => { if(e.key==='Enter') send(); });
function heart() { if (!me) return; spawnHearts(me);
  if (ONLINE && channel && subscribed) channel.send({type:'broadcast',event:'emote',payload:{id:myId}}); }
document.getElementById('heartBtn').onclick = heart;

// tombol Lemari (ganti baju saat di room)
(function addClosetBtn() {
  const bar = document.querySelector('.bar');
  const b = document.createElement('div'); b.className = 'btn'; b.id = 'closetBtn';
  b.textContent = '👕'; b.title = 'Ganti baju';
  b.onclick = () => { if (me) openBuilder('edit'); };
  bar.insertBefore(b, document.getElementById('heartBtn'));
})();

// ---------- chat / log / hearts ----------
function say(p, text) { p.bubble=text; p.bubT=performance.now()+5000; }
const logEl = document.getElementById('log');
function addLog(name, text, mine) { const d=document.createElement('div'); d.className='line'+(mine?' me':'');
  d.innerHTML='<b>'+esc(name)+'</b> '+esc(text); logEl.appendChild(d);
  while (logEl.children.length > 7) logEl.removeChild(logEl.firstChild); }
function esc(s) { return s.replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function spawnHearts(p) { const s=iso(p.fx,p.fy);
  for (let i=0; i<6; i++) parts.push({x:s.x+(Math.random()*30-15), y:s.y-34,
    vy:-0.6-Math.random()*0.5, vx:(Math.random()-.5)*0.5, life:1}); }

// ============================================================
//  DRAWING
// ============================================================
function diamond(x,y,fill) { ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+TW/2,y+TH/2);
  ctx.lineTo(x,y+TH); ctx.lineTo(x-TW/2,y+TH/2); ctx.closePath();
  ctx.fillStyle=fill; ctx.fill(); ctx.strokeStyle='rgba(0,0,0,.07)'; ctx.lineWidth=1; ctx.stroke(); }
function quad(x1,y1,x2,y2,x3,y3,x4,y4,fill) { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2);
  ctx.lineTo(x3,y3); ctx.lineTo(x4,y4); ctx.closePath(); ctx.fillStyle=fill; ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.12)'; ctx.lineWidth=1; ctx.stroke(); }
function drawDoorGap(ax,ay,bx,by,H) {
  // sill bawah (golden threshold)
  ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by);
  ctx.lineTo(bx,by-H*0.35); ctx.lineTo(ax,ay-H*0.35); ctx.closePath();
  ctx.fillStyle='#c89b45'; ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.18)'; ctx.lineWidth=1; ctx.stroke();
  // lorong gelap di atas
  ctx.beginPath(); ctx.moveTo(ax,ay-H*0.35); ctx.lineTo(bx,by-H*0.35);
  ctx.lineTo(bx,by-H); ctx.lineTo(ax,ay-H); ctx.closePath();
  ctx.fillStyle='rgba(20,16,40,.88)'; ctx.fill();
}
function drawFloor() {
  for (let gy=0; gy<GH; gy++) for (let gx=0; gx<GW; gx++) { const s=iso(gx,gy);
    diamond(s.x, s.y, (gx+gy)%2===0 ? C.floor : C.floor2); }
  const H = 46; const nb = getRoom().neighbors;
  for (let gx=0; gx<GW; gx++) { const a=iso(gx,0), b=iso(gx+1,0);
    (nb.up && (gx===GW/2-1 || gx===GW/2))
      ? drawDoorGap(a.x,a.y,b.x,b.y,H)
      : quad(a.x,a.y,b.x,b.y,b.x,b.y-H,a.x,a.y-H,C.wallL); }
  for (let gy=0; gy<GH; gy++) { const a=iso(0,gy), b=iso(0,gy+1);
    (nb.left && (gy===GH/2-1 || gy===GH/2))
      ? drawDoorGap(a.x,a.y,b.x,b.y,H)
      : quad(a.x,a.y,b.x,b.y,b.x,b.y-H,a.x,a.y-H,C.wallR); }
  const wins = getRoom().windows||[];
  wins.forEach(w => { const p=iso(0,w.gy); drawWindow(p.x,p.y-H+6); });
}
function drawWindow(x,y) { ctx.save(); ctx.fillStyle='#bfe6ff'; ctx.fillRect(x-2,y,30,28);
  ctx.strokeStyle=C.ink; ctx.lineWidth=2; ctx.strokeRect(x-2,y,30,28);
  ctx.beginPath(); ctx.moveTo(x+13,y); ctx.lineTo(x+13,y+28); ctx.moveTo(x-2,y+14); ctx.lineTo(x+28,y+14);
  ctx.stroke(); ctx.restore(); }
function drawFurniture(f) { const s=iso(f.gx,f.gy);
  if (f.kind==='rug') { ctx.save(); ctx.globalAlpha=.85;
    ctx.beginPath(); ctx.ellipse(s.x,s.y+TH/2,TW*1.05,TH*1.05,0,0,7); ctx.fillStyle=C.rose; ctx.fill();
    ctx.beginPath(); ctx.ellipse(s.x,s.y+TH/2,TW*0.7,TH*0.7,0,0,7); ctx.fillStyle='#ffd0de'; ctx.fill(); ctx.restore(); }
  if (f.kind==='plant') { ctx.fillStyle='#a9743f'; ctx.fillRect(s.x-9,s.y+6,18,16);
    ctx.fillStyle=C.mint; ctx.beginPath(); ctx.ellipse(s.x,s.y-2,16,20,0,0,7); ctx.fill();
    ctx.fillStyle='#6fc79b'; ctx.beginPath(); ctx.ellipse(s.x-6,s.y-6,9,13,-.4,0,7); ctx.fill();
    ctx.strokeStyle=C.ink; ctx.lineWidth=2; ctx.strokeRect(s.x-9,s.y+6,18,16); }
  if (f.kind==='lamp') { ctx.strokeStyle=C.ink; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(s.x,s.y+22); ctx.lineTo(s.x,s.y-22); ctx.stroke();
    ctx.fillStyle=C.sun; ctx.beginPath(); ctx.moveTo(s.x-14,s.y-22); ctx.lineTo(s.x+14,s.y-22);
    ctx.lineTo(s.x+9,s.y-40); ctx.lineTo(s.x-9,s.y-40); ctx.closePath(); ctx.fill();
    ctx.strokeStyle=C.ink; ctx.lineWidth=2; ctx.stroke(); }
  if (f.kind==='table') { ctx.fillStyle='#c98a4a'; ctx.beginPath(); ctx.moveTo(s.x,s.y-6); ctx.lineTo(s.x+30,s.y+9);
    ctx.lineTo(s.x,s.y+24); ctx.lineTo(s.x-30,s.y+9); ctx.closePath(); ctx.fill();
    ctx.strokeStyle=C.ink; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle='#a9743f'; ctx.fillRect(s.x-22,s.y+12,4,16); ctx.fillRect(s.x+18,s.y+12,4,16);
    ctx.fillStyle=C.cream; ctx.fillRect(s.x-12,s.y+2,8,7); ctx.fillRect(s.x+4,s.y+4,8,7); }
  if (f.kind==='treadmill') {
    ctx.fillStyle='#7a8ba0';
    ctx.beginPath(); ctx.moveTo(s.x,s.y-4); ctx.lineTo(s.x+28,s.y+10);
    ctx.lineTo(s.x,s.y+24); ctx.lineTo(s.x-28,s.y+10); ctx.closePath(); ctx.fill();
    ctx.strokeStyle=C.ink; ctx.lineWidth=2; ctx.stroke();
    ctx.strokeStyle='#4a5a6e'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(s.x-16,s.y+10); ctx.lineTo(s.x+16,s.y+10); ctx.stroke();
    ctx.strokeStyle=C.ink; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(s.x-10,s.y+6); ctx.lineTo(s.x-10,s.y-26); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s.x+10,s.y+6); ctx.lineTo(s.x+10,s.y-26); ctx.stroke();
    ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(s.x-10,s.y-26); ctx.lineTo(s.x+10,s.y-26); ctx.stroke();
    ctx.fillStyle='#5bc4e8'; ctx.fillRect(s.x-5,s.y-32,10,7);
    ctx.strokeStyle=C.ink; ctx.lineWidth=1.5; ctx.strokeRect(s.x-5,s.y-32,10,7); }
  if (f.kind==='dumbbell') {
    ctx.fillStyle='#8a8a8a'; ctx.strokeStyle=C.ink; ctx.lineWidth=1.5;
    ctx.fillRect(s.x-16,s.y-3,32,6); ctx.strokeRect(s.x-16,s.y-3,32,6);
    ctx.fillStyle='#3d3d3d';
    ctx.beginPath(); ctx.ellipse(s.x-18,s.y,5,8,0,0,7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(s.x+18,s.y,5,8,0,0,7); ctx.fill(); ctx.stroke(); }
  if (f.kind==='bench') {
    ctx.fillStyle='#666'; ctx.strokeStyle=C.ink; ctx.lineWidth=1.5;
    ctx.fillRect(s.x-20,s.y+10,4,14); ctx.strokeRect(s.x-20,s.y+10,4,14);
    ctx.fillRect(s.x+16,s.y+10,4,14); ctx.strokeRect(s.x+16,s.y+10,4,14);
    ctx.fillStyle='#7a4e2a';
    ctx.beginPath(); ctx.moveTo(s.x,s.y-4); ctx.lineTo(s.x+28,s.y+10);
    ctx.lineTo(s.x,s.y+24); ctx.lineTo(s.x-28,s.y+10); ctx.closePath(); ctx.fill();
    ctx.strokeStyle=C.ink; ctx.lineWidth=2; ctx.stroke();
    ctx.strokeStyle='#a06030'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(s.x-8,s.y+7); ctx.lineTo(s.x+8,s.y+7); ctx.stroke(); }
  if (f.kind==='yogamat') {
    ctx.save(); ctx.globalAlpha=0.88; ctx.fillStyle='#7fb3ff';
    ctx.beginPath(); ctx.moveTo(s.x-4,s.y-2); ctx.lineTo(s.x+36,s.y+16);
    ctx.lineTo(s.x+30,s.y+26); ctx.lineTo(s.x-10,s.y+8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle=C.ink; ctx.lineWidth=1.5; ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.45)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(s.x+4,s.y+1); ctx.lineTo(s.x+32,s.y+17); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s.x+12,s.y-1); ctx.lineTo(s.x+40,s.y+15); ctx.stroke();
    ctx.restore(); }
  if (f.kind==='mirror') {
    ctx.fillStyle='#3a3a50'; ctx.strokeStyle=C.ink; ctx.lineWidth=2;
    ctx.fillRect(s.x-11,s.y-42,22,46); ctx.strokeRect(s.x-11,s.y-42,22,46);
    ctx.fillStyle='#cde4ff'; ctx.save(); ctx.globalAlpha=0.82;
    ctx.fillRect(s.x-8,s.y-39,16,38); ctx.restore();
    ctx.fillStyle='rgba(255,255,255,.48)'; ctx.fillRect(s.x-6,s.y-37,3,30);
    ctx.fillStyle='#3a3a50'; ctx.strokeStyle=C.ink; ctx.lineWidth=1.5;
    ctx.fillRect(s.x-7,s.y+4,14,5); ctx.strokeRect(s.x-7,s.y+4,14,5); }
  if (f.kind==='cooler') {
    ctx.fillStyle='#e0f0ff'; ctx.strokeStyle=C.ink; ctx.lineWidth=2;
    ctx.fillRect(s.x-9,s.y-24,18,28); ctx.strokeRect(s.x-9,s.y-24,18,28);
    ctx.fillStyle='#90c8e8';
    ctx.fillRect(s.x-9,s.y-28,18,6); ctx.strokeRect(s.x-9,s.y-28,18,6);
    ctx.fillStyle='#b8e4ff'; ctx.save(); ctx.globalAlpha=0.9;
    ctx.beginPath(); ctx.ellipse(s.x,s.y-28,6,8,0,0,7); ctx.fill(); ctx.restore();
    ctx.strokeStyle=C.ink; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.ellipse(s.x,s.y-28,6,8,0,0,7); ctx.stroke();
    ctx.fillStyle='#5bc4e8'; ctx.strokeStyle=C.ink; ctx.lineWidth=1;
    ctx.fillRect(s.x-3,s.y-2,6,4); ctx.strokeRect(s.x-3,s.y-2,6,4); }
}
function drawDoorLabels() {
  const nb = getRoom().neighbors; const H = 46;
  ctx.save(); ctx.font='15px VT323'; ctx.textAlign='center'; ctx.fillStyle=C.sun;
  if (nb.up) { const p=iso(GW/2-0.5,0);
    ctx.fillText('▲ '+ROOMS[nb.up].name, p.x, p.y-H-6); }
  if (nb.left) { const p=iso(0,GH/2-0.5);
    ctx.fillText('◄ '+ROOMS[nb.left].name, p.x-18, p.y-H-6); }
  if (nb.down) { const p=iso(GW/2-0.5,GH-0.5);
    ctx.fillText('▼ '+ROOMS[nb.down].name, p.x, p.y+TH+4); }
  if (nb.right) { const p=iso(GW-0.5,GH/2-0.5);
    ctx.fillText('► '+ROOMS[nb.right].name, p.x+18, p.y+TH+4); }
  ctx.restore();
}

// gambar karakter di origin (kaki di 0,0) — dipakai room & preview
function drawChar(c, av, face) {
  const top = av.top||'plain', acc = av.acc||'none';
  const ex = face>=0 ? 2 : -2;
  c.fillStyle='rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(0,8,14,6,0,0,7); c.fill();
  c.fillStyle='#2b2640'; c.fillRect(-7,-6,5,8); c.fillRect(2,-6,5,8);          // kaki

  // dress: rok menutup kaki (digambar sebelum badan)
  if (top==='dress') {
    c.beginPath(); c.moveTo(-10,-6); c.lineTo(10,-6); c.lineTo(16,9); c.lineTo(-16,9); c.closePath();
    c.fillStyle=av.shirt; c.fill(); c.strokeStyle='#2b2640'; c.lineWidth=2; c.stroke();
  }

  rr(c,-10,-24,20,20,5,av.shirt); c.strokeStyle='#2b2640'; c.lineWidth=2; c.stroke(); // badan

  // detail baju
  if (top==='tee') {
    c.fillStyle=av.shirt; c.fillRect(-13,-22,4,8); c.fillRect(9,-22,4,8);
    c.strokeStyle='#2b2640'; c.lineWidth=1.5; c.strokeRect(-13,-22,4,8); c.strokeRect(9,-22,4,8);
    c.fillStyle='#fff6ec'; c.fillRect(-4,-24,8,2);
  } else if (top==='shirt') {
    c.fillStyle='#fff6ec'; c.fillRect(-2,-23,4,18);
    c.fillStyle='#2b2640'; [-19,-13,-7].forEach(by=>c.fillRect(-1,by,2,2));
    c.fillStyle='#fff6ec';
    c.beginPath(); c.moveTo(-5,-24); c.lineTo(0,-19); c.lineTo(-1,-24); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(5,-24);  c.lineTo(0,-19); c.lineTo(1,-24);  c.closePath(); c.fill();
  } else if (top==='hoodie') {
    c.fillStyle=av.shirt; c.beginPath(); c.arc(0,-23,9,Math.PI,0); c.fill();
    c.strokeStyle='#2b2640'; c.lineWidth=1.5; c.stroke();
    c.fillStyle='rgba(0,0,0,.12)'; c.fillRect(-7,-12,14,7);
    c.strokeStyle='#2b2640'; c.beginPath(); c.moveTo(-3,-22);c.lineTo(-3,-17); c.moveTo(3,-22);c.lineTo(3,-17); c.stroke();
  } else if (top==='apron') {
    rr(c,-8,-21,16,17,3,'#fff6ec'); c.strokeStyle='#2b2640'; c.lineWidth=1.5; c.stroke();
    c.strokeStyle='#2b2640'; c.beginPath(); c.moveTo(-5,-21);c.lineTo(-3,-26); c.moveTo(5,-21);c.lineTo(3,-26); c.stroke();
    c.fillStyle='#ff8fab'; c.beginPath(); c.ellipse(0,-11,2.5,2,0,0,7); c.fill();   // paw
    [[-3,-14],[0,-15],[3,-14]].forEach(([px,py])=>{c.beginPath();c.arc(px,py,1.1,0,7);c.fill();});
  }

  rr(c,-9,-40,18,18,7,av.skin); c.strokeStyle='#2b2640'; c.lineWidth=2; c.stroke(); // kepala
  // rambut
  c.fillStyle = av.hairColor;
  if (av.hair==='short') { c.beginPath(); c.arc(0,-34,10,Math.PI,0); c.fill();
    c.fillRect(-10,-34,3,7); c.fillRect(7,-34,3,7); }
  else if (av.hair==='long') { c.beginPath(); c.arc(0,-34,10,Math.PI,0); c.fill();
    c.fillRect(-11,-34,4,17); c.fillRect(7,-34,4,17); }
  else if (av.hair==='spiky') { [-8,-3,2,7].forEach(hx => { c.beginPath();
    c.moveTo(hx-3,-32); c.lineTo(hx+3,-32); c.lineTo(hx,-44); c.closePath(); c.fill(); });
    c.fillRect(-10,-34,20,3); }

  // aksesoris kepala (di atas rambut)
  if (acc==='cap') {
    c.fillStyle=av.shirt; c.beginPath(); c.arc(0,-38,11,Math.PI,0); c.fill();
    c.fillRect(2,-39,14,3);
    c.strokeStyle='#2b2640'; c.lineWidth=1.5; c.stroke();
  } else if (acc==='headband') {
    c.fillStyle='#ff8fab'; c.fillRect(-10,-39,20,3);
    c.beginPath(); c.moveTo(9,-39); c.lineTo(14,-42); c.lineTo(14,-36); c.closePath(); c.fill();
  }

  // mata + pipi
  c.fillStyle='#2b2640'; c.fillRect(-5+ex,-30,2.5,3); c.fillRect(2+ex,-30,2.5,3);
  c.fillStyle='rgba(255,143,171,.6)'; c.fillRect(-7+ex,-27,3,2); c.fillRect(5+ex,-27,3,2);

  // kacamata (di atas mata)
  if (acc==='glasses') {
    c.strokeStyle='#2b2640'; c.lineWidth=1.5;
    c.strokeRect(-6+ex,-32,5,5); c.strokeRect(1+ex,-32,5,5);
    c.beginPath(); c.moveTo(-1+ex,-30); c.lineTo(1+ex,-30); c.stroke();
  }
  // badge staff (di dada)
  if (acc==='badge') {
    rr(c,-9,-19,6,6,1,'#ffd23f'); c.strokeStyle='#2b2640'; c.lineWidth=1; c.stroke();
    c.fillStyle='#ff8fab'; c.beginPath(); c.arc(-6,-16,1,0,7); c.fill();
  }
}
function rr(c,x,y,w,h,r,fill) { c.beginPath(); c.moveTo(x+r,y);
  c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r);
  c.closePath(); c.fillStyle=fill; c.fill(); }

function drawAvatar(p, now) {
  if (!p.av || p.fx == null || isNaN(p.fx)) return;
  const s=iso(p.fx,p.fy); const bob=Math.sin(now/250+p.fx)*1.5; const x=s.x, y=s.y-bob;
  ctx.save(); ctx.translate(x,y); drawChar(ctx,p.av,p.face); ctx.restore();
  // nametag
  ctx.font='15px VT323'; ctx.textAlign='center';
  const tw = ctx.measureText(p.name).width + 12;
  rr(ctx, x-tw/2, y-58, tw, 16, 6, 'rgba(43,38,64,.85)');
  ctx.fillStyle='#fff'; ctx.fillText(p.name, x, y-46);
  if (p.bubble && now<p.bubT) drawBubble(x, y-64, p.bubble);
  else if (now>=p.bubT) p.bubble='';
}
function drawBubble(x, y, text) {
  ctx.font = '17px VT323';
  const w = Math.min(180, ctx.measureText(text).width+20);
  const lines=wrap(text, w-16); const h=lines.length*18+12; const bx=x-w/2, by=y-h;
  rr(ctx, bx, by, w, h, 8, C.cream); ctx.strokeStyle=C.ink; ctx.lineWidth=2.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x-6,by+h); ctx.lineTo(x+6,by+h); ctx.lineTo(x,by+h+9); ctx.closePath();
  ctx.fillStyle=C.cream; ctx.fill(); ctx.stroke();
  ctx.fillStyle=C.ink; ctx.textAlign='center';
  lines.forEach((l,i) => ctx.fillText(l, x, by+18+i*18));
}
function wrap(text, maxw) { const words=text.split(' '); const lines=[]; let cur='';
  for (const w of words) { const t=cur?cur+' '+w:w;
    if (ctx.measureText(t).width>maxw && cur) { lines.push(cur); cur=w; } else cur=t; }
  if (cur) lines.push(cur); return lines.slice(0,4); }

// ============================================================
//  LOOP
// ============================================================
let last = 0;
function loop(t) { const dt=Math.min((t-last)/1000,0.05); last=t; update(dt,t); render(t); requestAnimationFrame(loop); }
function moveToward(p, dt) { const dx=p.tx-p.fx, dy=p.ty-p.fy, d=Math.hypot(dx,dy);
  if (d>0.02) { const k=Math.min(1,(3.2*dt)/d); p.fx+=dx*k; p.fy+=dy*k; p.face=dx>=0?1:-1; }
  else { p.fx=p.tx; p.fy=p.ty; } }
function update(dt, t) {
  if (me) moveToward(me, dt); others.forEach(o => moveToward(o,dt));
  if (ONLINE && me) maybeSendMove();
  checkDoorZone();
  for (let i=parts.length-1; i>=0; i--) { const p=parts[i]; p.x+=p.vx; p.y+=p.vy; p.life-=dt*0.6;
    if (p.life<=0) parts.splice(i,1); }
}
function render(t) {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  // blit floor+walls+windows dari offscreen canvas — 1:1 device pixel, tidak blur
  // dw/dh = innerWidth/Height (logical): dengan transform DPR mengisi tepat cv.width x cv.height fisik
  ctx.drawImage(bgCanvas, 0, 0, innerWidth, innerHeight);
  const ents = [];
  getRoom().furniture.forEach(f => ents.push({d:depthOf(f.gx,f.gy), draw:()=>drawFurniture(f)}));
  if (me) ents.push({d:depthOf(me.fx,me.fy)+.01, draw:()=>drawAvatar(me,t)});
  others.forEach(o => ents.push({d:depthOf(o.fx,o.fy), draw:()=>drawAvatar(o,t)}));
  ents.sort((a,b) => a.d-b.d).forEach(e => e.draw());

  parts.forEach(p => { ctx.globalAlpha=Math.max(0,p.life); ctx.fillStyle=C.rose;
    ctx.font='18px VT323'; ctx.textAlign='center'; ctx.fillText('♥',p.x,p.y); ctx.globalAlpha=1; });
  drawDoorLabels();
  updateCount();
}

// -- updateCount: DOM hanya disentuh saat nilai benar-benar berubah --
let _countStr = '';
function updateCount() {
  const n = (me?1:0) + others.size;
  const s = ONLINE ? (statusLabel+' '+n+'/'+MAX_PEOPLE) : 'Demo '+n+'/'+MAX_PEOPLE;
  if (s === _countStr) return;
  _countStr = s;
  document.getElementById('statusTxt').textContent = s;
}

// ============================================================
//  DEMO mode
// ============================================================
function initDemo() {
  statusLabel = 'Demo';
  const names = ['Dara','Sok','Vannak','Lina','Rith'];
  names.forEach((nm,i) => {
    const av = {skin:SKINS[i%SKINS.length], hair:HAIR_STYLES[i%4][0],
      hairColor:HAIRC[i%HAIRC.length], shirt:SHIRTS[i%SHIRTS.length],
      top:TOPS[(i+1)%TOPS.length][0], acc:ACCS[i%ACCS.length][0]};
    const p = newPlayer({id:'npc'+i, name:nm, av, fx:1+i*1.6, fy:2+(i%3)});
    p.tx=p.fx; p.ty=p.fy; others.set(p.id, p);
  });
  setInterval(() => others.forEach(o => { if (Math.random()<0.5) {
    o.tx=Math.floor(Math.random()*GW); o.ty=Math.floor(Math.random()*GH); } }), 2600);
}
const demoLines = ["pagi semua!","udah kelar laporan?","istirahat dulu yuk","oke siap bos","mantap 👍","haha betul"];
let di = 0;
function demoReply() { const arr=[...others.values()]; if (!arr.length) return;
  const p = arr[Math.floor(Math.random()*arr.length)];
  setTimeout(() => { const l=demoLines[di++%demoLines.length]; say(p,l); addLog(p.name,l,false); }, 700+Math.random()*700); }

// ============================================================
//  ONLINE mode (Supabase Realtime + REST upsert)
// ============================================================
let channel=null, sb=null, statusLabel='Online', lastMoveSent=0, lastX=null, lastY=null;
let _reconnecting = false; // guard biar tidak dobel channel saat error beruntun
let moveStopTimer = null; // debounce: track() 600ms setelah berhenti gerak
let subscribed = false; // true hanya saat channel benar-benar SUBSCRIBED
let socket = null; // Socket.io — movement realtime, terpisah dari Supabase
let watchdogInterval = null, lastPresenceSuccess = 0; // deteksi Supabase channel yang mati diam-diam

function initOnline() {
  statusLabel = 'Connecting'; updateCount();
  saveProfile(); // upsert avatar staff ke DB (by nama)
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  s.onload = startRealtime; s.onerror = () => { statusLabel='Offline'; updateCount(); };
  document.head.appendChild(s);
}
async function saveProfile() {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {method:'POST',
      headers:{apikey:SUPABASE_ANON_KEY, Authorization:'Bearer '+SUPABASE_ANON_KEY,
        'Content-Type':'application/json', Prefer:'resolution=merge-duplicates'},
      body:JSON.stringify({name:me.name, avatar:me.av, updated_at:new Date().toISOString()})});
  } catch(e) {}
}
function startRealtime() {
  // createClient hanya sekali; resubscribe reuse sb yang sama
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  socket = io('https://driving-flights-economics-historic.trycloudflare.com');
  socket.on('connect', () => console.log('[socket] connected:', socket.id));
  socket.on('move', (data) => {
    const o = others.get(data.id);
    if (o) { o.tx = data.tx; o.ty = data.ty;
      if (!o.posSet) { o.fx = data.tx; o.fy = data.ty; o.posSet = true; } }
  });
  setupChannel();
}
function startWatchdog() {
  clearInterval(watchdogInterval);
  watchdogInterval = setInterval(() => {
    if (subscribed && (performance.now()-lastPresenceSuccess>15000)) {
      resubscribe(); // channel Supabase mati diam-diam: gak ada presence/track sukses
    }
  }, 8000);
}
function setupChannel() {
  const _topic = 'room:'+ROOM_CODE+':'+currentRoomId;
  const ch = sb.channel(_topic, {config:{presence:{key:myId}, broadcast:{self:false}}});
  channel = ch;

  ch.on('presence', {event:'sync'}, () => {
    const st = ch.presenceState(); const live = new Set();
    Object.entries(st).forEach(([id,arr]) => { if(id===myId) return; const v=arr[0]; live.add(id);
      if (!others.has(id)) others.set(id, newPlayer({id, name:v.name, av:v.av,
        ...(v.fx != null ? {fx:v.fx, fy:v.fy, tx:v.fx, ty:v.fy, posSet:true} : {})}));
      else { const o=others.get(id); o.name=v.name; o.av=v.av; } });
    [...others.keys()].forEach(id => { if (!live.has(id)) others.delete(id); });
    if (Object.keys(st).length > 0) lastPresenceSuccess = performance.now();
    updateCount();
  });
  ch.on('broadcast', {event:'chat'}, ({payload}) => { let o=others.get(payload.id);
    if (o) { say(o, payload.text); } addLog(payload.name, payload.text, false); });
  ch.on('broadcast', {event:'emote'}, ({payload}) => { const o=others.get(payload.id); if(o) spawnHearts(o); });

  ch.subscribe(async st => {
    if (st === 'SUBSCRIBED') {
      _reconnecting = false;
      subscribed = true;
      statusLabel = 'Online'; document.getElementById('dot').classList.add('on');
      await ch.track({name:me.name, av:me.av, fx:me.fx, fy:me.fy});
      lastPresenceSuccess = performance.now();
      if (socket) socket.emit('join-room', currentRoomId);
      updateCount();
    } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') {
      // reset flag dulu — jika reconnect attempt-nya sendiri gagal, retry tetap bisa jalan
      _reconnecting = false;
      statusLabel = 'Reconnecting'; document.getElementById('dot').classList.remove('on');
      updateCount(); setTimeout(resubscribe, 3000);
    }
  });
  startWatchdog();
}
async function resubscribe() {
  // guard: skip jika sudah ada proses reconnect berjalan
  if (!sb || !me || _reconnecting) return;
  _reconnecting = true;
  await cleanupChannel();
  setupChannel(); // reuse sb yang ada, tidak createClient ulang
}

// -- Ghost cleanup: untrack + removeChannel hanya saat tab benar-benar ditutup --
// Tidak untrack saat visibilitychange=hidden supaya avatar tidak kedip di mobile
async function cleanupChannel() {
  subscribed = false;
  clearInterval(watchdogInterval); watchdogInterval = null;
  if (!channel || !sb) return;
  const ch = channel;
  channel = null;
  try { await ch.untrack(); } catch(e) {}
  try { sb.removeChannel(ch); } catch(e) {}
}
window.addEventListener('beforeunload', cleanupChannel);
window.addEventListener('pagehide',     cleanupChannel); // lebih reliable di iOS Safari

// ============================================================
//  MULTI-ROOM — door latch + transition
// ============================================================
let doorArmed = false;
function checkDoorZone() {
  if (!me) return;
  const nb = getRoom().neighbors;
  const rx = Math.round(me.fx), ry = Math.round(me.fy);
  const inDoorX = rx === GW/2-1 || rx === GW/2;
  const inDoorY = ry === GH/2-1 || ry === GH/2;
  const nearUp    = !!nb.up    && me.fy < 0.5      && inDoorX;
  const nearDown  = !!nb.down  && me.fy > GH-1.5   && inDoorX;
  const nearLeft  = !!nb.left  && me.fx < 0.5      && inDoorY;
  const nearRight = !!nb.right && me.fx > GW-1.5   && inDoorY;
  const inAnyZone = nearUp || nearDown || nearLeft || nearRight;
  if (!inAnyZone) { doorArmed = true; return; }
  if (!doorArmed) return;
  if      (nearUp)    enterRoom(nb.up,    'up');
  else if (nearDown)  enterRoom(nb.down,  'down');
  else if (nearLeft)  enterRoom(nb.left,  'left');
  else if (nearRight) enterRoom(nb.right, 'right');
}
async function enterRoom(roomId, fromSide) {
  doorArmed = false;
  currentRoomId = roomId;
  const r = getRoom();
  GW = r.grid.w; GH = r.grid.h;
  const cx = r.grid.w/2 - 0.5, cy = r.grid.h/2 - 0.5;
  const sp = {
    up:    {fx:cx,           fy:r.grid.h-2},
    down:  {fx:cx,           fy:1},
    left:  {fx:r.grid.w-2,  fy:cy},
    right: {fx:1,            fy:cy},
  }[fromSide];
  me.fx=sp.fx; me.fy=sp.fy; me.tx=sp.fx; me.ty=sp.fy;
  _countStr = '';
  updateOrigin();
  buildRoomBG();
  document.getElementById('roomTitle').innerHTML = r.name.replace(/\n/g,'<br>');
  if (ONLINE) {
    _reconnecting = false;
    statusLabel = 'Connecting';
    await cleanupChannel(); // tunggu untrack+removeChannel lama beres dulu
    others.clear();         // baru clear setelah channel lama benar-benar mati
    updateCount();
    setupChannel();
    if (socket) socket.emit('join-room', currentRoomId);
  } else {
    others.clear();
    updateCount();
  }
}

function sendMove() { if (socket && socket.connected) socket.emit('move', { room: currentRoomId, id: myId, tx: me.tx, ty: me.ty }); }
function maybeSendMove() { const now=performance.now();
  if (now-lastMoveSent>120 && (me.tx!==lastX || me.ty!==lastY)) { lastMoveSent=now; lastX=me.tx; lastY=me.ty;
    sendMove();
    clearTimeout(moveStopTimer);
    moveStopTimer = setTimeout(() => { if (channel && subscribed) channel.track({name:me.name, av:me.av, fx:me.fx, fy:me.fy}).then(() => { lastPresenceSuccess = performance.now(); }); }, 600);
  } }

// -- Mobile: naikkan chat bar + log saat keyboard virtual muncul --
if (window.visualViewport) {
  const _bar = document.querySelector('.bar');
  window.visualViewport.addEventListener('resize', () => {
    const vp = window.visualViewport;
    const kb = Math.max(0, window.innerHeight - vp.offsetTop - vp.height);
    _bar.style.bottom = kb + 'px';
    logEl.style.bottom = (74 + kb) + 'px';
  });
}

// ---------- start ----------
showGate();