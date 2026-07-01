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
    neighbors:{up:'gym',down:null,left:'garden',right:'gameroom'},
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
    neighbors:{up:null,down:'lobby',left:'kitchen',right:'office'},
  },
  garden: {
    name:'Garden', grid:{w:10,h:10},
    palette:{floor:'#c8d89a',floor2:'#b8c88a',wallL:'#6a8a4a',wallR:'#5a7a3a'},
    windows:[],
    furniture:[
      {gx:4.5,gy:4.5,kind:'fountain'},
      {gx:1,  gy:1,  kind:'tree'},{gx:8,gy:1,kind:'tree'},
      {gx:1,  gy:8,  kind:'tree'},{gx:8,gy:8,kind:'tree'},
      {gx:4.5,gy:1.5,kind:'flowerbed'},{gx:2,gy:6,kind:'flowerbed'},{gx:7,gy:6,kind:'flowerbed'},
      {gx:2.5,gy:8,  kind:'bench'},{gx:6.5,gy:8,kind:'bench'},
    ],
    neighbors:{up:null,down:null,left:'stadium',right:'lobby'},
  },
  kitchen: {
    name:'Kitchen', grid:{w:10,h:10},
    palette:{floor:'#e8d5b0',floor2:'#dcc89a',wallL:'#c8a84a',wallR:'#b8983a'},
    windows:[],
    furniture:[
      {gx:1,gy:1,kind:'counter'},{gx:8,gy:1,kind:'counter'},
      {gx:2,gy:2,kind:'stove'},
      {gx:8,gy:2,kind:'fridge'},
      {gx:5,gy:1,kind:'sink'},
      {gx:4.5,gy:6,kind:'table'},
      {gx:3,gy:6,kind:'bench'},{gx:6,gy:6,kind:'bench'},
    ],
    neighbors:{up:'rooftop',down:null,left:null,right:'gym'},
  },
  gameroom: {
    name:'Game Room', grid:{w:10,h:10},
    palette:{floor:'#2d2d4e',floor2:'#252540',wallL:'#1a1a3a',wallR:'#141430'},
    windows:[],
    furniture:[
      {gx:1,  gy:2,  kind:'arcade'},{gx:8,gy:2,kind:'arcade'},
      {gx:4.5,gy:1.5,kind:'tv'},
      {gx:4.5,gy:5,  kind:'sofa'},
      {gx:4.5,gy:7.5,kind:'table'},
      {gx:8,  gy:8,  kind:'lamp'},
    ],
    neighbors:{up:null,down:null,left:'lobby',right:'casino'},
  },
  office: {
    name:'Office', grid:{w:10,h:10},
    palette:{floor:'#d8d8e0',floor2:'#c8c8d0',wallL:'#7080a0',wallR:'#607090'},
    windows:[],
    furniture:[
      {gx:2,gy:2,kind:'computer'},{gx:5,gy:2,kind:'computer'},{gx:8,gy:2,kind:'computer'},
      {gx:1,gy:5,kind:'whiteboard'},
      {gx:8,gy:5,kind:'bookshelf'},
      {gx:1,gy:8,kind:'plant'},{gx:8,gy:8,kind:'plant'},
    ],
    neighbors:{up:null,down:null,left:'gym',right:'beach'},
  },
  stadium: {
    name:'Stadium', grid:{w:20,h:16},
    palette:{floor:'#4a8a3a',floor2:'#3d7a2d',wallL:'#8a8a8a',wallR:'#7a7a7a'},
    windows:[],
    furniture:[
      {gx:10,gy:2, kind:'goalpost'},{gx:10,gy:13,kind:'goalpost'},
      {gx:2, gy:2, kind:'corner_flag'},{gx:18,gy:2, kind:'corner_flag'},
      {gx:2, gy:13,kind:'corner_flag'},{gx:18,gy:13,kind:'corner_flag'},
      {gx:1, gy:4, kind:'stadium_seat'},{gx:1, gy:11,kind:'stadium_seat'},
      {gx:18,gy:4, kind:'stadium_seat'},{gx:18,gy:11,kind:'stadium_seat'},
      {gx:10,gy:1, kind:'scoreboard'},
    ],
    neighbors:{up:null,down:null,left:null,right:'garden'},
  },
  beach: {
    name:'Beach', grid:{w:18,h:14},
    palette:{floor:'#e8d08a',floor2:'#dcc070',wallL:'#2a6aaa',wallR:'#1a5a9a'},
    windows:[],
    furniture:[
      {gx:3, gy:6,  kind:'beach_umbrella'},{gx:3, gy:8.5,kind:'beach_chair'},
      {gx:9, gy:6,  kind:'beach_umbrella'},{gx:9, gy:8.5,kind:'beach_chair'},
      {gx:15,gy:6,  kind:'beach_umbrella'},{gx:15,gy:8.5,kind:'beach_chair'},
      {gx:1, gy:6,  kind:'surfboard'},{gx:1, gy:11, kind:'surfboard'},
      {gx:9, gy:11, kind:'beach_ball'},
      {gx:5, gy:11, kind:'cooler_box'},{gx:13,gy:11,kind:'cooler_box'},
      {gx:9, gy:9.5,kind:'table'},
    ],
    neighbors:{up:null,down:null,left:'office',right:null},
  },
  casino: {
    name:'Casino', grid:{w:18,h:16},
    palette:{floor:'#8B1a1a',floor2:'#7a1515',wallL:'#8B6914',wallR:'#7a5a10'},
    windows:[],
    furniture:[
      {gx:5,  gy:6,  kind:'roulette_table'},{gx:12,gy:6,  kind:'roulette_table'},
      {gx:3,  gy:3,  kind:'card_table'},{gx:15, gy:3,  kind:'card_table'},{gx:8.5,gy:11, kind:'card_table'},
      {gx:16, gy:2,  kind:'slot_machine'},{gx:16,gy:6,  kind:'slot_machine'},
      {gx:16, gy:10, kind:'slot_machine'},{gx:16,gy:14, kind:'slot_machine'},
      {gx:8.5,gy:1,  kind:'casino_bar'},
      {gx:2,  gy:1,  kind:'dealer_sign'},{gx:15,gy:14, kind:'dealer_sign'},
    ],
    neighbors:{up:null,down:null,left:'gameroom',right:null},
  },
  rooftop: {
    name:'Rooftop', grid:{w:16,h:14},
    palette:{floor:'#4a4a5a',floor2:'#3a3a4a',wallL:'#1a1a2e',wallR:'#0f0f1e'},
    windows:[],
    furniture:[
      {gx:3,  gy:8,  kind:'outdoor_sofa'},{gx:11, gy:8,  kind:'outdoor_sofa'},
      {gx:5,  gy:5,  kind:'rooftop_table'},{gx:10, gy:5, kind:'rooftop_table'},
      {gx:1,  gy:1,  kind:'planter'},{gx:14, gy:1, kind:'planter'},{gx:7.5,gy:12, kind:'planter'},
      {gx:2,  gy:11, kind:'water_tower'},{gx:13, gy:11, kind:'water_tower'},
      {gx:4,  gy:6.5,kind:'string_lights'},{gx:11,gy:6.5, kind:'string_lights'},
      {gx:4,  gy:0.5, kind:'city_view'},{gx:12, gy:0.5, kind:'city_view'},
    ],
    neighbors:{up:null,down:'kitchen',left:null,right:null},
  },
};
const FRAMES = {
  lobby:    [ {gy:2, wall:'left', img:'assets/lobby-1.webp',   frame:'gold'},
              {gy:7, wall:'top',  img:'assets/lobby-2.webp',   frame:'gold'} ], // gx:5 nabrak pintu lobby<->gym, dipindah ke 7
  gym:      [ {gy:2, wall:'left', img:'assets/gym-1.webp',     frame:'metal'},
              {gy:6, wall:'top',  img:'assets/gym-2.webp',     frame:'metal'} ],
  garden:   [ {gy:2, wall:'left', img:'assets/garden-1.webp',  frame:'wood'},
              {gy:6, wall:'top',  img:'assets/garden-2.webp',  frame:'wood'} ],
  kitchen:  [ {gy:2, wall:'left', img:'assets/kitchen-1.webp', frame:'white'},
              {gy:6, wall:'top',  img:'assets/kitchen-2.webp', frame:'white'} ],
  gameroom: [ {gy:2, wall:'left', img:'assets/game-1.webp',    frame:'neon'},
              {gy:6, wall:'top',  img:'assets/game-2.webp',    frame:'neon'} ],
  office:   [ {gy:2, wall:'left', img:'assets/office-1.webp',  frame:'dark'},
              {gy:6, wall:'top',  img:'assets/office-2.webp',  frame:'dark'} ],
  stadium:  [ {gy:5,  wall:'left', img:'assets/stadium-1.webp', frame:'metal'},
              {gy:15, wall:'top',  img:'assets/stadium-2.webp', frame:'metal'} ],
  beach:    [ {gy:2, wall:'left', img:'assets/beach-1.webp', frame:'wood'},
              {gy:8, wall:'top',  img:'assets/beach-2.webp', frame:'wood'} ],
  casino:   [ {gy:2,  wall:'left', img:'assets/casino-1.webp', frame:'gold'},
              {gy:9,  wall:'top',  img:'assets/casino-2.webp', frame:'gold'} ],
  rooftop:  [ {gy:2, wall:'left', img:'assets/rooftop-1.webp', frame:'dark'},
              {gy:6, wall:'top',  img:'assets/rooftop-2.webp', frame:'dark'} ],
};
const ROOM_PLACEHOLDER = { lobby:'#e8b4c8', gym:'#8aa0c0', garden:'#8fc98a', kitchen:'#e0b878', gameroom:'#9a7ad6', office:'#a8b4c8', stadium:'#6a9a5a', beach:'#f0d8a0', casino:'#8B1a1a', rooftop:'#1a1a2e' };
const FRAME_STYLES = {
  gold:  {border:'#c8a020', thick:4, mat:'#fff6ec'},
  metal: {border:'#aaaaaa', thick:2, mat:null},
  wood:  {border:'#8B5e3c', thick:3, mat:null},
  white: {border:'#f0f0f0', thick:2, mat:null},
  neon:  {border:'#1a1a2e', thick:3, mat:null, glow:['#c060ff','#5bf0ff']},
  dark:  {border:'#2a2a3a', thick:3, mat:null},
};
const _frameImgCache = new Map();
function getFrameImage(path) {
  let entry = _frameImgCache.get(path);
  if (entry) return entry;
  const img = new Image();
  entry = { img, status:'loading' };
  _frameImgCache.set(path, entry);
  img.onload  = () => { entry.status='loaded';
    if ((FRAMES[currentRoomId]||[]).some(f => f.img===path)) buildRoomBG(); }; // gambar telat load -> rebuild bg biar keganti
  img.onerror = () => { entry.status='error'; }; // tetap placeholder selamanya, gak retry
  img.src = path;
  return entry;
}
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
  const cx = e.clientX-r.left, cy = e.clientY-r.top;
  const hit = frameHitAt(cx, cy);
  if (hit) { openFrameModal(hit.frame, hit.idx); return; }
  const t = unIso(cx, cy);
  me.tx = Math.max(0, Math.min(GW-1, Math.round(t.gx)));
  me.ty = Math.max(0, Math.min(GH-1, Math.round(t.gy)));
});
function frameHitAt(cx, cy) {
  const list = FRAMES[currentRoomId]; if (!list) return null;
  for (let i=0; i<list.length; i++) {
    const f = list[i]; const a = frameWallAnchor(f);
    if (Math.abs(cx-a.x) < 24 && Math.abs(cy-a.y) < 16) return { frame:f, idx:i };
  }
  return null;
}
function openFrameModal(frame, idx) {
  const modal = document.getElementById('frame-modal'); if (!modal) return;
  const img = document.getElementById('frameModalImg');
  const wrap = document.getElementById('frameImgWrap');
  wrap.style.background = ROOM_PLACEHOLDER[currentRoomId] || '#888';
  img.style.display = '';
  img.onerror = () => { img.style.display = 'none'; }; // gambar belum ada -> placeholder color kelihatan
  img.src = frame.img;
  document.getElementById('frameModalCaption').textContent = getRoom().name + ' — Photo ' + (idx+1);
  modal.style.display = 'flex';
}
function closeFrameModal() {
  const modal = document.getElementById('frame-modal'); if (modal) modal.style.display = 'none';
}
(function initFrameModal() {
  const modal = document.getElementById('frame-modal');
  if (!modal) return;
  modal.addEventListener('click', e => { if (e.target === modal) closeFrameModal(); });
  const closeBtn = document.getElementById('frameCloseBtn');
  if (closeBtn) closeBtn.onclick = closeFrameModal;
  window.addEventListener('keydown', e => { if (e.key === 'Escape') closeFrameModal(); });
})();
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
  drawRoomFrames();
  if (currentRoomId==='stadium') drawStadiumField();
  if (currentRoomId==='casino') drawCasinoDecor();
  if (currentRoomId==='rooftop') drawRooftopDecor();
}
// -- Beach: gelombang + kilau pasir, dianimasikan tiap frame di render() bukan di-bake ke bgCanvas --
const BEACH_SPARKLES = [[3,3],[7,5],[11,2],[5,9],[14,7],[9,11],[2,10],[16,10]]; // posisi tetap, cuma opacity yang goyang
const BEACH_WAVE_BANDS = [
  {gy:0.5, color:'#4db8ff', alpha:0.7, fillAlpha:0.3,  lw:3},
  {gy:2,   color:'#80ccff', alpha:0.6, fillAlpha:0.25, lw:2.5},
  {gy:3.5, color:'#ffffff', alpha:0.5, fillAlpha:0.2,  lw:2},
];
function waveCrestY(gx, bi, t) {
  // amplitudo 8px, fase geser seiring waktu (t/300) = efek ombak scroll masuk ke pantai
  return Math.sin(gx*0.4 + t/300 + bi*1.7) * 8;
}
function drawBeachWaveBand(c, band, bi, t) {
  const step = 2, thickness = 26; // tebal isi band di bawah garis crest, biar solid bukan cuma garis
  c.beginPath();
  const first = iso(0, band.gy);
  const y0 = first.y + waveCrestY(0, bi, t);
  c.moveTo(first.x, y0);
  const pts = [{x:first.x, y:y0}];
  for (let gx = step; gx <= GW; gx += step) {
    const mid = iso(gx - step/2, band.gy);
    const end = iso(gx, band.gy);
    const midY = mid.y + waveCrestY(gx - step/2, bi, t);
    const endY = end.y + waveCrestY(gx, bi, t);
    c.quadraticCurveTo(mid.x, midY, end.x, endY);
    pts.push({x:end.x, y:endY});
  }
  c.globalAlpha = band.alpha; c.strokeStyle = band.color; c.lineWidth = band.lw;
  c.stroke(); // garis crest warna band dulu, sebelum path dilanjut turun ke base
  c.globalAlpha = Math.min(1, band.alpha + 0.25); c.strokeStyle = '#ffffff'; c.lineWidth = 1;
  c.stroke(); // busa putih tipis persis di puncak gelombang
  const last = pts[pts.length-1];
  c.lineTo(last.x, last.y + thickness);
  c.lineTo(first.x, y0 + thickness);
  c.closePath();
  c.globalAlpha = band.fillAlpha; c.fillStyle = band.color;
  c.fill(); // isi solid di bawah garis crest
}
function drawBeachDecor(c, t) {
  c.save();
  // clip ke area lantai (diamond iso) biar wave gak nembus keluar wall kanan/pinggir
  const top = iso(0,0), right = iso(GW,0), bottom = iso(GW,GH), left = iso(0,GH);
  c.beginPath();
  c.moveTo(top.x, top.y);
  c.lineTo(right.x, right.y);
  c.lineTo(bottom.x, bottom.y);
  c.lineTo(left.x, left.y);
  c.closePath();
  c.clip();
  BEACH_WAVE_BANDS.forEach((band, bi) => drawBeachWaveBand(c, band, bi, t));
  c.globalAlpha = 1; // reset biar sparkle dots (pake rgba sendiri) gak ke-multiply
  BEACH_SPARKLES.forEach(([gx,gy], i) => {
    const alpha = 0.25 + 0.45 * (0.5 + 0.5*Math.sin(t/500 + i*1.3));
    const p = iso(gx, gy);
    c.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    c.beginPath(); c.arc(p.x, p.y, 1.5, 0, 7); c.fill();
  });
  c.restore();
}
function drawStadiumField() {
  const p = iso(9.5, 7.5); // titik tengah lapangan
  ctx.save();
  ctx.strokeStyle='rgba(255,255,255,.55)'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.ellipse(p.x, p.y, 90, 45, 0, 0, Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 7); ctx.fillStyle='rgba(255,255,255,.7)'; ctx.fill();
  const a=iso(9.5,0), b=iso(9.5,GH-0.1); // garis tengah lapangan
  ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
  ctx.restore();
}
function drawCasinoDecor() {
  ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = '#5a0f0f';
  for (let gy=1; gy<GH-1; gy+=2) for (let gx=1; gx<GW-1; gx+=2) {
    const s = iso(gx, gy);
    ctx.beginPath(); ctx.moveTo(s.x, s.y-6); ctx.lineTo(s.x+10, s.y+2);
    ctx.lineTo(s.x, s.y+10); ctx.lineTo(s.x-10, s.y+2); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  ctx.save(); ctx.strokeStyle = '#c8a020'; ctx.lineWidth = 3;
  const top = iso(0,0), right = iso(GW,0), bottom = iso(GW,GH), left = iso(0,GH);
  ctx.beginPath(); ctx.moveTo(top.x,top.y); ctx.lineTo(right.x,right.y);
  ctx.lineTo(bottom.x,bottom.y); ctx.lineTo(left.x,left.y); ctx.closePath(); ctx.stroke();
  ctx.restore();
}
function drawRooftopDecor() {
  const H = 46;
  ctx.save(); ctx.strokeStyle='rgba(0,0,0,.15)'; ctx.lineWidth=1;
  for (let gx=2; gx<GW; gx+=2) { const a=iso(gx,0), b=iso(gx,GH);
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); }
  for (let gy=2; gy<GH; gy+=2) { const a=iso(0,gy), b=iso(GW,gy);
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); }
  ctx.restore();
  const p = iso(GW-1.5, 0);
  ctx.save();
  ctx.fillStyle = '#f0f0d8';
  ctx.beginPath(); ctx.arc(p.x, p.y-H-20, 10, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(15,15,30,.55)';
  ctx.beginPath(); ctx.arc(p.x+4, p.y-H-23, 9, 0, 7); ctx.fill();
  ctx.restore();
}
function drawWindow(x,y) { ctx.save(); ctx.fillStyle='#bfe6ff'; ctx.fillRect(x-2,y,30,28);
  ctx.strokeStyle=C.ink; ctx.lineWidth=2; ctx.strokeRect(x-2,y,30,28);
  ctx.beginPath(); ctx.moveTo(x+13,y); ctx.lineTo(x+13,y+28); ctx.moveTo(x-2,y+14); ctx.lineTo(x+28,y+14);
  ctx.stroke(); ctx.restore(); }
function frameWallAnchor(f) {
  const H = 46;
  const a = f.wall==='top' ? iso(f.gy, 0)   : iso(0, f.gy);
  const b = f.wall==='top' ? iso(f.gy+1, 0) : iso(0, f.gy+1);
  return { x:a.x, y:a.y-H+6, shear:(b.y-a.y)/(b.x-a.x) };
}
function drawFrame(ctx, x, y, shear, style, imgPath, placeholderColor) {
  const w=36, h=28; const st = FRAME_STYLES[style] || FRAME_STYLES.dark;
  const bx=-w/2, by=-h/2;
  ctx.save();
  ctx.translate(x, y);
  ctx.transform(1, shear, 0, 1, 0, 0); // ikutin kemiringan wall biar nempel rata, bukan ngambang
  if (st.glow) { ctx.save(); ctx.strokeStyle=st.glow[1]; ctx.lineWidth=1; ctx.globalAlpha=.8;
    ctx.strokeRect(bx-2,by-2,w+4,h+4); ctx.restore(); }
  ctx.save();
  if (st.glow) { ctx.shadowColor=st.glow[0]; ctx.shadowBlur=8; }
  ctx.fillStyle=st.border; ctx.strokeStyle=C.ink; ctx.lineWidth=1.5;
  ctx.fillRect(bx,by,w,h); ctx.strokeRect(bx,by,w,h);
  ctx.restore();
  let ix=bx+st.thick, iy=by+st.thick, iw=w-st.thick*2, ih=h-st.thick*2;
  if (st.mat) { ctx.fillStyle=st.mat; ctx.fillRect(ix,iy,iw,ih); ix+=3; iy+=3; iw-=6; ih-=6; }
  const entry = getFrameImage(imgPath);
  if (entry.status==='loaded') ctx.drawImage(entry.img, ix, iy, iw, ih);
  else { ctx.fillStyle=placeholderColor; ctx.fillRect(ix,iy,iw,ih); }
  ctx.strokeStyle='rgba(0,0,0,.3)'; ctx.lineWidth=1; ctx.strokeRect(ix,iy,iw,ih);
  ctx.restore();
}
function drawRoomFrames() {
  const list = FRAMES[currentRoomId]; if (!list) return;
  const ph = ROOM_PLACEHOLDER[currentRoomId] || '#cccccc';
  list.forEach(f => { const a = frameWallAnchor(f); drawFrame(ctx, a.x, a.y, a.shear, f.frame, f.img, ph); });
}
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
  if (f.kind==='fountain') {
    ctx.fillStyle='#9fa8b0'; ctx.strokeStyle=C.ink; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(s.x,s.y+10,26,14,0,0,7); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#5bc4e8'; ctx.save(); ctx.globalAlpha=0.85;
    ctx.beginPath(); ctx.ellipse(s.x,s.y+8,20,10,0,0,7); ctx.fill(); ctx.restore();
    ctx.strokeStyle=C.ink; ctx.lineWidth=1.5; ctx.beginPath(); ctx.ellipse(s.x,s.y+8,20,10,0,0,7); ctx.stroke();
    ctx.fillStyle='#9fa8b0'; ctx.fillRect(s.x-4,s.y-14,8,22); ctx.strokeRect(s.x-4,s.y-14,8,22);
    ctx.fillStyle='#bfe9f5'; ctx.save(); ctx.globalAlpha=0.9;
    ctx.beginPath(); ctx.ellipse(s.x,s.y-16,9,7,0,0,7); ctx.fill(); ctx.restore();
    ctx.strokeStyle=C.ink; ctx.lineWidth=1.5; ctx.beginPath(); ctx.ellipse(s.x,s.y-16,9,7,0,0,7); ctx.stroke(); }
  if (f.kind==='flowerbed') {
    ctx.save(); ctx.globalAlpha=.9;
    ctx.beginPath(); ctx.ellipse(s.x,s.y+TH/2,TW*0.55,TH*0.55,0,0,7); ctx.fillStyle='#3f8a4a'; ctx.fill();
    ctx.strokeStyle=C.ink; ctx.lineWidth=1.5; ctx.stroke();
    [['#ff6b81',-14,-3],['#ffd23f',-2,4],['#ff6b6b',10,-4],['#ffd23f',-8,8],['#ff6b81',6,6],['#fff275',0,-8]]
      .forEach(([c,dx,dy]) => { ctx.fillStyle=c; ctx.beginPath(); ctx.arc(s.x+dx, s.y+TH/2+dy, 3, 0, 7); ctx.fill(); });
    ctx.restore(); }
  if (f.kind==='tree') {
    ctx.fillStyle='#7a5233'; ctx.fillRect(s.x-6,s.y+2,12,20);
    ctx.strokeStyle=C.ink; ctx.lineWidth=2; ctx.strokeRect(s.x-6,s.y+2,12,20);
    ctx.fillStyle='#2f6b3a'; ctx.beginPath(); ctx.ellipse(s.x,s.y-16,24,26,0,0,7); ctx.fill();
    ctx.strokeStyle=C.ink; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle='#3f8a4a'; ctx.beginPath(); ctx.ellipse(s.x-8,s.y-22,12,14,0,0,7); ctx.fill(); }
  if (f.kind==='stove') {
    ctx.fillStyle='#4a4a4a'; ctx.strokeStyle=C.ink; ctx.lineWidth=2;
    ctx.fillRect(s.x-16,s.y-10,32,24); ctx.strokeRect(s.x-16,s.y-10,32,24);
    ctx.fillStyle='#2a2a2a';
    [[-9,-4],[9,-4],[-9,6],[9,6]].forEach(([dx,dy]) => { ctx.beginPath();
      ctx.ellipse(s.x+dx,s.y+dy,4,3,0,0,7); ctx.fill(); ctx.strokeStyle=C.ink; ctx.lineWidth=1; ctx.stroke(); }); }
  if (f.kind==='fridge') {
    ctx.fillStyle='#e8ecef'; ctx.strokeStyle=C.ink; ctx.lineWidth=2;
    ctx.fillRect(s.x-12,s.y-44,24,48); ctx.strokeRect(s.x-12,s.y-44,24,48);
    ctx.strokeStyle='rgba(0,0,0,.15)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(s.x-12,s.y-18); ctx.lineTo(s.x+12,s.y-18); ctx.stroke();
    ctx.fillStyle='#9aa4ab'; ctx.fillRect(s.x+6,s.y-38,3,12); ctx.fillRect(s.x+6,s.y-14,3,12); }
  if (f.kind==='counter') {
    ctx.fillStyle='#d9b98a'; ctx.strokeStyle=C.ink; ctx.lineWidth=2;
    ctx.fillRect(s.x-30,s.y-6,60,14); ctx.strokeRect(s.x-30,s.y-6,60,14);
    ctx.fillStyle='#a9743f'; ctx.fillRect(s.x-28,s.y+8,4,10); ctx.fillRect(s.x+24,s.y+8,4,10); }
  if (f.kind==='sink') {
    ctx.fillStyle='#c4cdd4'; ctx.strokeStyle=C.ink; ctx.lineWidth=2;
    ctx.fillRect(s.x-16,s.y-6,32,16); ctx.strokeRect(s.x-16,s.y-6,32,16);
    ctx.fillStyle='#7a8890'; ctx.fillRect(s.x-11,s.y-2,22,9);
    ctx.strokeStyle=C.ink; ctx.lineWidth=1; ctx.strokeRect(s.x-11,s.y-2,22,9);
    ctx.strokeStyle=C.ink; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(s.x,s.y-6); ctx.lineTo(s.x,s.y-16); ctx.lineTo(s.x+8,s.y-16); ctx.stroke(); }
  if (f.kind==='arcade') {
    ctx.fillStyle='#3a3a4a'; ctx.strokeStyle=C.ink; ctx.lineWidth=2;
    ctx.fillRect(s.x-11,s.y-46,22,50); ctx.strokeRect(s.x-11,s.y-46,22,50);
    ctx.fillStyle='#ff5ea8'; ctx.save(); ctx.globalAlpha=.9;
    ctx.fillRect(s.x-8,s.y-40,16,18); ctx.restore();
    ctx.strokeStyle=C.ink; ctx.lineWidth=1.5; ctx.strokeRect(s.x-8,s.y-40,16,18);
    ctx.fillStyle='#5bc4e8'; ctx.fillRect(s.x-6,s.y-37,5,5);
    ctx.fillStyle='#ffd23f'; ctx.fillRect(s.x+1,s.y-30,5,5);
    ctx.fillStyle='#2a2a38'; ctx.fillRect(s.x-9,s.y-18,18,10); ctx.strokeRect(s.x-9,s.y-18,18,10);
    ctx.fillStyle='#8a2be2'; ctx.beginPath(); ctx.arc(s.x-3,s.y-13,2,0,7); ctx.fill();
    ctx.fillStyle='#ff5ea8'; ctx.beginPath(); ctx.arc(s.x+4,s.y-13,2,0,7); ctx.fill(); }
  if (f.kind==='sofa') {
    ctx.fillStyle='#7a5cff'; ctx.strokeStyle=C.ink; ctx.lineWidth=2;
    ctx.fillRect(s.x-32,s.y-4,64,20); ctx.strokeRect(s.x-32,s.y-4,64,20);
    ctx.fillRect(s.x-32,s.y-22,8,22); ctx.strokeRect(s.x-32,s.y-22,8,22);
    ctx.fillRect(s.x+24,s.y-22,8,22); ctx.strokeRect(s.x+24,s.y-22,8,22);
    ctx.fillStyle='#9b85ff';
    ctx.fillRect(s.x-20,s.y-2,16,14); ctx.strokeRect(s.x-20,s.y-2,16,14);
    ctx.fillRect(s.x+4,s.y-2,16,14); ctx.strokeRect(s.x+4,s.y-2,16,14); }
  if (f.kind==='tv') {
    ctx.fillStyle='#1a1a1a'; ctx.strokeStyle=C.ink; ctx.lineWidth=2;
    ctx.fillRect(s.x-20,s.y-30,40,24); ctx.strokeRect(s.x-20,s.y-30,40,24);
    ctx.fillStyle='#5bc4e8'; ctx.save(); ctx.globalAlpha=.85;
    ctx.fillRect(s.x-17,s.y-27,34,18); ctx.restore();
    ctx.fillStyle='#3a3a3a'; ctx.fillRect(s.x-4,s.y-6,8,8); ctx.strokeRect(s.x-4,s.y-6,8,8);
    ctx.fillRect(s.x-14,s.y+2,28,4); ctx.strokeRect(s.x-14,s.y+2,28,4); }
  if (f.kind==='computer') {
    ctx.fillStyle='#c9a06a'; ctx.strokeStyle=C.ink; ctx.lineWidth=2;
    ctx.fillRect(s.x-20,s.y+2,40,10); ctx.strokeRect(s.x-20,s.y+2,40,10);
    ctx.fillStyle='#a9743f'; ctx.fillRect(s.x-18,s.y+12,4,10); ctx.fillRect(s.x+14,s.y+12,4,10);
    ctx.fillStyle='#2a2a2a'; ctx.fillRect(s.x-3,s.y-8,6,10); ctx.strokeRect(s.x-3,s.y-8,6,10);
    ctx.fillRect(s.x-13,s.y-28,26,20); ctx.strokeRect(s.x-13,s.y-28,26,20);
    ctx.fillStyle='#5bc4e8'; ctx.save(); ctx.globalAlpha=.85;
    ctx.fillRect(s.x-10,s.y-25,20,14); ctx.restore();
    ctx.fillStyle='#3a3a3a'; ctx.fillRect(s.x-8,s.y-1,16,3); }
  if (f.kind==='whiteboard') {
    ctx.fillStyle='#f5f5f0'; ctx.strokeStyle=C.ink; ctx.lineWidth=2;
    ctx.fillRect(s.x-16,s.y-40,32,34); ctx.strokeRect(s.x-16,s.y-40,32,34);
    ctx.strokeStyle='#5bc4e8'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(s.x-11,s.y-30); ctx.lineTo(s.x+6,s.y-30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s.x-11,s.y-23); ctx.lineTo(s.x+11,s.y-23); ctx.stroke();
    ctx.strokeStyle='#ff5ea8'; ctx.beginPath(); ctx.moveTo(s.x-11,s.y-16); ctx.lineTo(s.x+2,s.y-16); ctx.stroke();
    ctx.fillStyle='#c4cdd4'; ctx.fillRect(s.x-3,s.y-6,6,6);
    ctx.strokeStyle=C.ink; ctx.lineWidth=1.5; ctx.strokeRect(s.x-3,s.y-6,6,6); }
  if (f.kind==='bookshelf') {
    ctx.fillStyle='#8a5a34'; ctx.strokeStyle=C.ink; ctx.lineWidth=2;
    ctx.fillRect(s.x-14,s.y-46,28,50); ctx.strokeRect(s.x-14,s.y-46,28,50);
    ctx.strokeStyle='#5a3a20'; ctx.lineWidth=1.5;
    [-30,-14,2].forEach(dy => { ctx.beginPath(); ctx.moveTo(s.x-14,s.y+dy); ctx.lineTo(s.x+14,s.y+dy); ctx.stroke(); });
    const cols=['#ff8fab','#7fb3ff','#8fd9b6','#ffd23f','#c79bff'];
    [-40,-24,-8].forEach((rowY,ri) => { for (let i=0;i<5;i++) { ctx.fillStyle=cols[(i+ri)%cols.length];
      ctx.fillRect(s.x-12+i*5,s.y+rowY,4,12); } }); }
  if (f.kind==='goalpost') {
    ctx.strokeStyle='rgba(150,150,150,.5)'; ctx.lineWidth=1;
    for (let i=-4;i<=4;i+=2) { ctx.beginPath(); ctx.moveTo(s.x+i,s.y+2); ctx.lineTo(s.x+i*0.5,s.y-10); ctx.stroke(); }
    for (let j=-10;j<=2;j+=3) { ctx.beginPath(); ctx.moveTo(s.x-4,s.y+j); ctx.lineTo(s.x+4,s.y+j-3); ctx.stroke(); }
    ctx.strokeStyle='#f5f5f5'; ctx.lineWidth=2.5; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(s.x-4,s.y+2); ctx.lineTo(s.x-4,s.y-10); ctx.lineTo(s.x+4,s.y-10); ctx.lineTo(s.x+4,s.y+2); ctx.stroke();
    ctx.lineCap='butt'; }
  if (f.kind==='corner_flag') {
    ctx.strokeStyle='#f5f5f5'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(s.x,s.y+2); ctx.lineTo(s.x,s.y-10); ctx.stroke();
    ctx.fillStyle='#ffd23f';
    ctx.beginPath(); ctx.moveTo(s.x,s.y-10); ctx.lineTo(s.x+6,s.y-8); ctx.lineTo(s.x,s.y-6); ctx.closePath(); ctx.fill(); }
  if (f.kind==='stadium_seat') {
    ctx.fillStyle='#6a6a6a'; ctx.strokeStyle=C.ink; ctx.lineWidth=2;
    ctx.fillRect(s.x-16,s.y-18,32,22); ctx.strokeRect(s.x-16,s.y-18,32,22);
    const rowColors=['#e04040','#4070e0'];
    for (let row=0; row<3; row++) for (let col=0; col<6; col++) {
      ctx.fillStyle = rowColors[(row+col)%2];
      ctx.beginPath(); ctx.arc(s.x-13+col*5, s.y-14+row*6, 1.8, 0, 7); ctx.fill();
    } }
  if (f.kind==='scoreboard') {
    ctx.fillStyle='#1a1a1a'; ctx.strokeStyle='#ffd23f'; ctx.lineWidth=3;
    ctx.fillRect(s.x-26,s.y-40,52,30); ctx.strokeRect(s.x-26,s.y-40,52,30);
    ctx.fillStyle='#5bf05b'; ctx.font='9px VT323'; ctx.textAlign='center';
    ctx.fillText('STADIUM', s.x, s.y-22);
    ctx.font='7px VT323'; ctx.fillText('0 - 0', s.x, s.y-12); }
  if (f.kind==='beach_umbrella') {
    ctx.strokeStyle='#8a5a34'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(s.x,s.y+15); ctx.lineTo(s.x,s.y-35); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(s.x,s.y-35,20,Math.PI,0); ctx.clip();
    const stripeCols=['#e04040','#ffffff'];
    for (let i=-20;i<20;i+=5) { ctx.fillStyle=stripeCols[Math.abs(i)%10<5?0:1]; ctx.fillRect(s.x+i,s.y-60,5,30); }
    ctx.restore();
    ctx.strokeStyle=C.ink; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(s.x,s.y-35,20,Math.PI,0); ctx.stroke(); }
  if (f.kind==='beach_chair') {
    ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(-0.15);
    ctx.fillStyle='#ffd23f'; ctx.strokeStyle=C.ink; ctx.lineWidth=2;
    ctx.fillRect(-10,-5,20,10); ctx.strokeRect(-10,-5,20,10);
    ctx.strokeStyle='rgba(0,0,0,.2)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(-7,-5); ctx.lineTo(-7,5); ctx.moveTo(0,-5); ctx.lineTo(0,5); ctx.moveTo(7,-5); ctx.lineTo(7,5); ctx.stroke();
    ctx.restore(); }
  if (f.kind==='surfboard') {
    rr(ctx,s.x-4,s.y-42,8,30,3,'#5bc4e8'); ctx.strokeStyle=C.ink; ctx.lineWidth=2; ctx.stroke();
    ctx.strokeStyle='#fff'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(s.x,s.y-39); ctx.lineTo(s.x,s.y-15); ctx.stroke();
    ctx.fillStyle='#ff8fab'; ctx.beginPath(); ctx.arc(s.x,s.y-27,5,0,7); ctx.fill(); }
  if (f.kind==='beach_ball') {
    const cols=['#e04040','#4070e0','#ffd23f','#ffffff'];
    for (let i=0;i<4;i++) { ctx.fillStyle=cols[i];
      ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.arc(s.x,s.y,10,i*Math.PI/2,(i+1)*Math.PI/2); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle=C.ink; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(s.x,s.y,10,0,7); ctx.stroke(); }
  if (f.kind==='cooler_box') {
    ctx.fillStyle='#e0f0ff'; ctx.strokeStyle=C.ink; ctx.lineWidth=2;
    ctx.fillRect(s.x-10,s.y-15,20,15); ctx.strokeRect(s.x-10,s.y-15,20,15);
    ctx.strokeStyle='#7a8890'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(s.x-5,s.y-15); ctx.lineTo(s.x-5,s.y-23); ctx.lineTo(s.x+5,s.y-23); ctx.lineTo(s.x+5,s.y-15); ctx.stroke(); }
  if (f.kind==='roulette_table') {
    ctx.fillStyle='#1a6b1a'; ctx.strokeStyle='#c8a020'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.ellipse(s.x,s.y,28,16,0,0,7); ctx.fill(); ctx.stroke();
    const segCols=['#c8302a','#1a1a1a'];
    for (let i=0;i<8;i++) { ctx.fillStyle=segCols[i%2];
      ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.arc(s.x,s.y,8,i*Math.PI/4,(i+1)*Math.PI/4); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle=C.ink; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(s.x,s.y,8,0,7); ctx.stroke();
    ctx.fillStyle='#c8a020'; ctx.beginPath(); ctx.arc(s.x,s.y,2,0,7); ctx.fill(); }
  if (f.kind==='card_table') {
    ctx.fillStyle='#1a5a1a'; ctx.strokeStyle='#c8a020'; ctx.lineWidth=2.5;
    ctx.fillRect(s.x-15,s.y-8,30,16); ctx.strokeRect(s.x-15,s.y-8,30,16);
    ctx.strokeStyle='rgba(255,255,255,.55)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(s.x,s.y,10,Math.PI*0.1,Math.PI*0.9); ctx.stroke(); }
  if (f.kind==='slot_machine') {
    ctx.fillStyle='#c8302a'; ctx.strokeStyle=C.ink; ctx.lineWidth=2;
    ctx.fillRect(s.x-6,s.y-20,12,20); ctx.strokeRect(s.x-6,s.y-20,12,20);
    ctx.fillStyle='#1a1a1a'; ctx.fillRect(s.x-5,s.y-17,10,7); ctx.strokeRect(s.x-5,s.y-17,10,7);
    const symCols=['#ffd23f','#5bc4e8','#ff5ea8'];
    [-4,0,4].forEach((dx,i)=>{ ctx.fillStyle=symCols[i]; ctx.fillRect(s.x+dx-1,s.y-15,2,3); });
    ctx.strokeStyle='#8a8a8a'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(s.x+6,s.y-14); ctx.lineTo(s.x+11,s.y-18); ctx.stroke();
    ctx.fillStyle='#c8302a'; ctx.beginPath(); ctx.arc(s.x+11,s.y-19,2,0,7); ctx.fill(); }
  if (f.kind==='casino_bar') {
    ctx.fillStyle='#3a1a08'; ctx.strokeStyle=C.ink; ctx.lineWidth=2;
    ctx.fillRect(s.x-18,s.y-4,36,8); ctx.strokeRect(s.x-18,s.y-4,36,8);
    const cols=['#5bc4e8','#ffd23f','#ff5ea8','#8fd9b6'];
    [-13,-5,3,11].forEach((dx,i)=>{ ctx.fillStyle=cols[i]; ctx.fillRect(s.x+dx,s.y-9,3,5); }); }
  if (f.kind==='dealer_sign') {
    ctx.fillStyle='#1a1a1a'; ctx.strokeStyle='#c8a020'; ctx.lineWidth=2.5;
    ctx.fillRect(s.x-24,s.y-30,48,16); ctx.strokeRect(s.x-24,s.y-30,48,16);
    ctx.fillStyle='#ffd23f'; ctx.font='11px VT323'; ctx.textAlign='center';
    ctx.fillText('CASINO', s.x, s.y-19); }
  if (f.kind==='outdoor_sofa') {
    ctx.fillStyle='#7a7a8a'; ctx.strokeStyle=C.ink; ctx.lineWidth=2;
    ctx.fillRect(s.x-14,s.y-2,28,10); ctx.strokeRect(s.x-14,s.y-2,28,10);
    ctx.fillStyle='#9a9aaa';
    [-11,-1,9].forEach(dx => { ctx.fillRect(s.x+dx,s.y-6,8,6); ctx.strokeRect(s.x+dx,s.y-6,8,6); });
    ctx.fillStyle='#2a2a3a';
    [[-13,7],[11,7],[-13,-1],[11,-1]].forEach(([dx,dy]) => ctx.fillRect(s.x+dx,s.y+dy,3,4)); }
  if (f.kind==='string_lights') {
    const y = s.y-40, xs=s.x-20, xe=s.x+20;
    ctx.strokeStyle='rgba(40,30,20,.7)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(xs,y); ctx.quadraticCurveTo(s.x,y+6,xe,y); ctx.stroke();
    for (let i=0;i<9;i++) { const t=i/8, bx=xs+(xe-xs)*t, by=y+6*Math.sin(Math.PI*t);
      ctx.save(); ctx.shadowColor='#ffdd88'; ctx.shadowBlur=6;
      ctx.fillStyle='#ffdd88'; ctx.beginPath(); ctx.arc(bx,by+2,2,0,7); ctx.fill(); ctx.restore(); } }
  if (f.kind==='rooftop_table') {
    ctx.fillStyle='#3a3a3a'; ctx.strokeStyle=C.ink; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(s.x,s.y,10,0,7); ctx.fill(); ctx.stroke();
    ctx.fillStyle='rgba(180,220,255,.55)';
    ctx.beginPath(); ctx.arc(s.x,s.y,7,0,7); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.4)'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#4a4a5a'; ctx.strokeStyle=C.ink; ctx.lineWidth=1.5;
    [[-16,4],[16,4]].forEach(([dx,dy]) => { ctx.beginPath(); ctx.arc(s.x+dx,s.y+dy,4,0,7); ctx.fill(); ctx.stroke(); }); }
  if (f.kind==='planter') {
    ctx.fillStyle='#3a3a3a'; ctx.strokeStyle=C.ink; ctx.lineWidth=2;
    ctx.fillRect(s.x-8,s.y,16,8); ctx.strokeRect(s.x-8,s.y,16,8);
    ctx.fillStyle='#3f8a4a';
    ctx.beginPath(); ctx.ellipse(s.x,s.y-4,10,8,0,0,7); ctx.fill();
    const cols=['#ff6b81','#ffd23f','#ff6b6b'];
    [[-4,-6],[3,-4],[-1,-8]].forEach(([dx,dy],i) => { ctx.fillStyle=cols[i]; ctx.beginPath(); ctx.arc(s.x+dx,s.y+dy,2,0,7); ctx.fill(); }); }
  if (f.kind==='water_tower') {
    ctx.fillStyle='#4a3a2a'; ctx.strokeStyle=C.ink; ctx.lineWidth=2;
    ctx.fillRect(s.x-12,s.y-30,24,26); ctx.strokeRect(s.x-12,s.y-30,24,26);
    ctx.beginPath(); ctx.ellipse(s.x,s.y-30,12,5,0,0,7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle='#2a1a10'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(s.x-6,s.y-4); ctx.lineTo(s.x-9,s.y+8); ctx.moveTo(s.x+6,s.y-4); ctx.lineTo(s.x+9,s.y+8); ctx.stroke(); }
  if (f.kind==='city_view') {
    const H=46, baseY = s.y - H;
    const buildings = [[-26,30,'#12121f'],[-10,42,'#181828'],[6,26,'#0d0d18'],[22,36,'#151522']];
    buildings.forEach(([dx,h,col],bi) => {
      ctx.fillStyle = col; ctx.fillRect(s.x+dx, baseY-h, 14, h);
      ctx.fillStyle = '#ffd23f';
      for (let wy=6; wy<h-6; wy+=9) for (let wx=3; wx<10; wx+=6) {
        if ((wx+wy+bi)%5!==0) continue;
        ctx.fillRect(s.x+dx+wx, baseY-h+wy, 2, 3);
      }
    }); }
}
// -- Stadium NPC: random walker lokal, gak sync network --
const STADIUM_NPC_NAMES = ['Budi','Sari','Deni','Rini','Agus','Dewi','Hendra','Putri'];
const _npcHair = ['short','long','spiky'], _npcTops = ['plain','tee','shirt','hoodie'];
const stadiumNPCs = STADIUM_NPC_NAMES.map((name,i) => ({
  fx: 3+Math.random()*14, fy: 3+Math.random()*9,
  tx: 3+Math.random()*14, ty: 3+Math.random()*9,
  speed: 1.5+Math.random(), name, pauseT: 0, face: 1,
  av: {
    skin: SKINS[Math.floor(Math.random()*SKINS.length)],
    hairColor: HAIRC[Math.floor(Math.random()*HAIRC.length)],
    hair: _npcHair[Math.floor(Math.random()*_npcHair.length)],
    shirt: SHIRTS[Math.floor(Math.random()*SHIRTS.length)],
    top: _npcTops[Math.floor(Math.random()*_npcTops.length)],
    acc: 'none',
  },
}));
const stadiumBall = { fx:10, fy:8, tx:10, ty:8, speed:6, holder:0, targetIdx:null, nextPassAt:0 };
function initStadiumBall() {
  const now = performance.now();
  stadiumBall.fx = stadiumBall.tx = 10;
  stadiumBall.fy = stadiumBall.ty = 8;
  stadiumBall.holder = Math.floor(Math.random()*stadiumNPCs.length);
  stadiumBall.targetIdx = null;
  stadiumBall.nextPassAt = now + 2000 + Math.random()*2000;
}
function updateStadiumNPCs(dt, now) {
  stadiumNPCs.forEach(n => {
    if (n.pauseT > now) return;
    const dx=n.tx-n.fx, dy=n.ty-n.fy, d=Math.hypot(dx,dy);
    if (d>0.05) { const k=Math.min(1,(n.speed*dt)/d); n.fx+=dx*k; n.fy+=dy*k; n.face=dx>=0?1:-1; }
    else { n.tx=3+Math.random()*14; n.ty=3+Math.random()*9; n.pauseT=now+1000+Math.random()*2000; }
  });
}
function updateStadiumBall(dt, now) {
  const b = stadiumBall;
  if (b.holder != null) {
    const h = stadiumNPCs[b.holder];
    b.fx = h.fx; b.fy = h.fy; // dribble: ikutin posisi holder
    if (now >= b.nextPassAt) {
      let idx; do { idx = Math.floor(Math.random()*stadiumNPCs.length); } while (idx === b.holder);
      b.targetIdx = idx;
      b.tx = stadiumNPCs[idx].fx; b.ty = stadiumNPCs[idx].fy;
      b.holder = null; // lepas, bola melayang ke target
    }
    return;
  }
  if (b.targetIdx == null) { // gak ada holder & gak ada target -> otomatis cari NPC terdekat
    let best=0, bestD=Infinity;
    stadiumNPCs.forEach((n,i) => { const d=Math.hypot(n.fx-b.fx, n.fy-b.fy); if (d<bestD) { bestD=d; best=i; } });
    b.targetIdx = best;
    b.tx = stadiumNPCs[best].fx; b.ty = stadiumNPCs[best].fy;
  }
  const dx=b.tx-b.fx, dy=b.ty-b.fy, d=Math.hypot(dx,dy);
  if (d>0.05) { const k=Math.min(1,(b.speed*dt)/d); b.fx+=dx*k; b.fy+=dy*k; }
  const target = stadiumNPCs[b.targetIdx];
  if (Math.hypot(target.fx-b.fx, target.fy-b.fy) < 1.5) {
    b.holder = b.targetIdx; b.targetIdx = null;
    b.nextPassAt = now + 2000 + Math.random()*2000;
  }
}
function drawNPC(n) {
  const s = iso(n.fx, n.fy);
  ctx.save(); ctx.translate(s.x, s.y); ctx.scale(1.15,1.15); drawChar(ctx, n.av, n.face); ctx.restore();
  // nametag, sama kayak player
  ctx.font='15px VT323'; ctx.textAlign='center';
  const tw = ctx.measureText(n.name).width + 12;
  rr(ctx, s.x-tw/2, s.y-58, tw, 16, 6, 'rgba(43,38,64,.85)');
  ctx.fillStyle='#fff'; ctx.fillText(n.name, s.x, s.y-46);
}
function drawBall(b) {
  let bx=b.fx, by=b.fy;
  if (b.holder != null) { const h=stadiumNPCs[b.holder]; bx=h.fx+(h.face||1)*0.3; by=h.fy; }
  const s = iso(bx, by);
  ctx.save();
  ctx.fillStyle='#fff'; ctx.strokeStyle=C.ink; ctx.lineWidth=1;
  ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#1a1a1a';
  ctx.beginPath();
  for (let i=0;i<5;i++) { const a=-Math.PI/2+i*(Math.PI*2/5), r=2;
    const px=s.x+Math.cos(a)*r, py=s.y+Math.sin(a)*r;
    i===0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py); }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
// -- Beach NPC: sama polanya kayak stadium, tapi lebih santai (lambat + jeda lama) --
const BEACH_NPC_NAMES = ['Surfer','Santai','Liburan','Chill'];
const beachNPCs = BEACH_NPC_NAMES.map(name => ({
  fx: 3+Math.random()*12, fy: 3+Math.random()*8,
  tx: 3+Math.random()*12, ty: 3+Math.random()*8,
  speed: 0.4, name, pauseT: 0, face: 1,
  av: {
    skin: SKINS[Math.floor(Math.random()*SKINS.length)],
    hairColor: HAIRC[Math.floor(Math.random()*HAIRC.length)],
    hair: _npcHair[Math.floor(Math.random()*_npcHair.length)],
    shirt: SHIRTS[Math.floor(Math.random()*SHIRTS.length)],
    top: _npcTops[Math.floor(Math.random()*_npcTops.length)],
    acc: 'none',
  },
}));
function updateBeachNPCs(dt, now) {
  beachNPCs.forEach(n => {
    if (n.pauseT > now) return;
    const dx=n.tx-n.fx, dy=n.ty-n.fy, d=Math.hypot(dx,dy);
    if (d>0.05) { const k=Math.min(1,(n.speed*dt)/d); n.fx+=dx*k; n.fy+=dy*k; n.face=dx>=0?1:-1; }
    else { n.tx=3+Math.random()*12; n.ty=3+Math.random()*8; n.pauseT=now+3000+Math.random()*3000; }
  });
}
// -- Casino NPC: sama polanya, gerak antar meja dengan jeda medium (2-4s) --
const CASINO_NPC_NAMES = ['Dealer','Lucky','Jackpot','Chips','Ace','Joker'];
const CASINO_SHIRTS = ['#2a2a3a','#1a2a4a','#3a1a1a','#241a3a'];
const casinoNPCs = CASINO_NPC_NAMES.map(name => ({
  fx: 2+Math.random()*14, fy: 2+Math.random()*12,
  tx: 2+Math.random()*14, ty: 2+Math.random()*12,
  speed: 0.8, name, pauseT: 0, face: 1,
  av: {
    skin: SKINS[Math.floor(Math.random()*SKINS.length)],
    hairColor: HAIRC[Math.floor(Math.random()*HAIRC.length)],
    hair: _npcHair[Math.floor(Math.random()*_npcHair.length)],
    shirt: CASINO_SHIRTS[Math.floor(Math.random()*CASINO_SHIRTS.length)],
    top: 'shirt',
    acc: 'none',
  },
}));
function updateCasinoNPCs(dt, now) {
  casinoNPCs.forEach(n => {
    if (n.pauseT > now) return;
    const dx=n.tx-n.fx, dy=n.ty-n.fy, d=Math.hypot(dx,dy);
    if (d>0.05) { const k=Math.min(1,(n.speed*dt)/d); n.fx+=dx*k; n.fy+=dy*k; n.face=dx>=0?1:-1; }
    else { n.tx=2+Math.random()*14; n.ty=2+Math.random()*12; n.pauseT=now+2000+Math.random()*2000; }
  });
}
// -- Rooftop NPC: santai, jalan pelan sambil nikmatin pemandangan --
const ROOFTOP_NPC_NAMES = ['Sky','Bintang','Malam','Angin','Langit'];
const rooftopNPCs = ROOFTOP_NPC_NAMES.map(name => ({
  fx: 2+Math.random()*12, fy: 2+Math.random()*10,
  tx: 2+Math.random()*12, ty: 2+Math.random()*10,
  speed: 0.5, name, pauseT: 0, face: 1,
  av: {
    skin: SKINS[Math.floor(Math.random()*SKINS.length)],
    hairColor: HAIRC[Math.floor(Math.random()*HAIRC.length)],
    hair: _npcHair[Math.floor(Math.random()*_npcHair.length)],
    shirt: SHIRTS[Math.floor(Math.random()*SHIRTS.length)],
    top: _npcTops[Math.floor(Math.random()*_npcTops.length)],
    acc: 'none',
  },
}));
function updateRooftopNPCs(dt, now) {
  rooftopNPCs.forEach(n => {
    if (n.pauseT > now) return;
    const dx=n.tx-n.fx, dy=n.ty-n.fy, d=Math.hypot(dx,dy);
    if (d>0.05) { const k=Math.min(1,(n.speed*dt)/d); n.fx+=dx*k; n.fy+=dy*k; n.face=dx>=0?1:-1; }
    else { n.tx=2+Math.random()*12; n.ty=2+Math.random()*10; n.pauseT=now+4000+Math.random()*3000; }
  });
}
const ROOFTOP_STARS = [
  {wall:'top',  gx:1,  h:38},{wall:'top',  gx:4,  h:20},{wall:'top', gx:7,  h:34},
  {wall:'top',  gx:10, h:15},{wall:'top',  gx:13, h:28},
  {wall:'left', gy:2,  h:32},{wall:'left', gy:5,  h:18},{wall:'left', gy:8,  h:36},
  {wall:'left', gy:11, h:22},
];
function drawRooftopStars(t) {
  ctx.save();
  ROOFTOP_STARS.forEach((st, i) => {
    const a = st.wall==='top' ? iso(st.gx, 0) : iso(0, st.gy);
    const x = a.x, y = a.y - st.h;
    ctx.globalAlpha = 0.4 + 0.6*Math.abs(Math.sin(t/600 + i*1.3));
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, 1.4, 0, 7); ctx.fill();
  });
  ctx.restore();
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
  rr(c,-7,-6,5,8,2,'#2b2640'); rr(c,2,-6,5,8,2,'#2b2640');                    // kaki

  // lengan + tangan (arms + hands, selalu pakai warna av.skin)
  c.strokeStyle='#2b2640'; c.lineWidth=1.5;
  rr(c,-12,-19,3,14,2,av.skin); c.stroke();
  rr(c,9, -19,3,14,2,av.skin); c.stroke();
  c.fillStyle=av.skin;
  c.beginPath(); c.arc(-10.5,-3,2.5,0,7); c.fill(); c.stroke();
  c.beginPath(); c.arc(10.5,-3,2.5,0,7);  c.fill(); c.stroke();

  // dress: rok menutup kaki (digambar sebelum badan)
  if (top==='dress') {
    c.beginPath(); c.moveTo(-10,-6); c.lineTo(10,-6); c.lineTo(16,9); c.lineTo(-16,9); c.closePath();
    c.fillStyle=av.shirt; c.fill(); c.strokeStyle='#2b2640'; c.lineWidth=2; c.stroke();
  }

  rr(c,-10,-20,20,16,5,av.shirt); c.strokeStyle='#2b2640'; c.lineWidth=2; c.stroke(); // badan

  // detail baju
  if (top==='tee') {
    c.fillStyle='#fff6ec'; c.fillRect(-13,-22,4,8); c.fillRect(9,-22,4,8);
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

  rr(c,-10,-42,20,20,9,av.skin); c.strokeStyle='#2b2640'; c.lineWidth=2; c.stroke(); // kepala
  // rambut
  c.fillStyle = av.hairColor;
  if (av.hair==='short') { c.beginPath(); c.arc(0,-34,8,Math.PI,0); c.fill();
    c.fillRect(-8,-34,3,3); c.fillRect(5,-34,3,3); }
  else if (av.hair==='long') { c.beginPath(); c.arc(0,-34,10,Math.PI,0); c.fill();
    if (acc!=='cap') { c.fillRect(-11,-34,4,17); c.fillRect(7,-34,4,17); } }
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
    c.strokeStyle='#2b2640'; c.lineWidth=2;
    c.strokeRect(-7+ex,-32,7,7); c.strokeRect(1+ex,-32,7,7);
    c.beginPath(); c.moveTo(0+ex,-29); c.lineTo(1+ex,-29); c.stroke();
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
  ctx.save(); ctx.translate(x,y); ctx.scale(1.15,1.15); drawChar(ctx,p.av,p.face); ctx.restore();
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
  if (currentRoomId==='stadium') { updateStadiumNPCs(dt, t); updateStadiumBall(dt, t); }
  if (currentRoomId==='beach') updateBeachNPCs(dt, t);
  if (currentRoomId==='casino') updateCasinoNPCs(dt, t);
  if (currentRoomId==='rooftop') updateRooftopNPCs(dt, t);
  for (let i=parts.length-1; i>=0; i--) { const p=parts[i]; p.x+=p.vx; p.y+=p.vy; p.life-=dt*0.6;
    if (p.life<=0) parts.splice(i,1); }
}
function render(t) {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  // blit floor+walls+windows dari offscreen canvas — 1:1 device pixel, tidak blur
  // dw/dh = innerWidth/Height (logical): dengan transform DPR mengisi tepat cv.width x cv.height fisik
  ctx.drawImage(bgCanvas, 0, 0, innerWidth, innerHeight);
  if (currentRoomId==='beach') drawBeachDecor(ctx, t);
  if (currentRoomId==='rooftop') drawRooftopStars(t);
  const ents = [];
  getRoom().furniture.forEach(f => ents.push({d:depthOf(f.gx,f.gy), draw:()=>drawFurniture(f)}));
  if (me) ents.push({d:depthOf(me.fx,me.fy)+.01, draw:()=>drawAvatar(me,t)});
  others.forEach(o => ents.push({d:depthOf(o.fx,o.fy), draw:()=>drawAvatar(o,t)}));
  if (currentRoomId==='stadium') stadiumNPCs.forEach(n => ents.push({d:depthOf(n.fx,n.fy), draw:()=>drawNPC(n)}));
  if (currentRoomId==='beach') beachNPCs.forEach(n => ents.push({d:depthOf(n.fx,n.fy), draw:()=>drawNPC(n)}));
  if (currentRoomId==='casino') casinoNPCs.forEach(n => ents.push({d:depthOf(n.fx,n.fy), draw:()=>drawNPC(n)}));
  if (currentRoomId==='rooftop') rooftopNPCs.forEach(n => ents.push({d:depthOf(n.fx,n.fy), draw:()=>drawNPC(n)}));
  if (currentRoomId==='stadium') ents.push({d:depthOf(stadiumBall.fx,stadiumBall.fy)-.01, draw:()=>drawBall(stadiumBall)});
  ents.sort((a,b) => a.d-b.d).forEach(e => e.draw());
  drawAmbient(t);

  parts.forEach(p => { ctx.globalAlpha=Math.max(0,p.life); ctx.fillStyle=C.rose;
    ctx.font='18px VT323'; ctx.textAlign='center'; ctx.fillText('♥',p.x,p.y); ctx.globalAlpha=1; });
  drawDoorLabels();
  updateCount();
}

// -- Ambient furniture animations: dihitung murni dari t, tanpa state tambahan --
function drawAmbient(t) {
  getRoom().furniture.forEach(f => {
    if      (f.kind==='fountain') drawFountainSpray(f, t);
    else if (f.kind==='tv')       drawTvFlicker(f, t);
    else if (f.kind==='computer') drawComputerGlow(f, t);
    else if (f.kind==='stove')    drawStoveShimmer(f, t);
    else if (f.kind==='slot_machine') drawSlotFlash(f, t);
    else if (f.kind==='string_lights') drawStringLightsPulse(f, t);
  });
}
function drawSlotFlash(f, t) {
  const s = iso(f.gx, f.gy);
  const on = Math.floor(t/400 + (f.gx+f.gy)) % 2 === 0;
  ctx.save();
  ctx.fillStyle = on ? '#ffd23f' : '#8a6800';
  ctx.beginPath(); ctx.arc(s.x, s.y-21, 2.5, 0, 7); ctx.fill();
  ctx.restore();
}
function drawStringLightsPulse(f, t) {
  const s = iso(f.gx, f.gy);
  const y = s.y-40, xs=s.x-20, xe=s.x+20;
  for (let i=0;i<9;i++) { const tt=i/8, bx=xs+(xe-xs)*tt, by=y+6*Math.sin(Math.PI*tt);
    const pulse = 0.5+0.5*Math.sin(t/300 + i*0.9);
    ctx.save(); ctx.globalAlpha = 0.5+pulse*0.5;
    ctx.shadowColor='#ffdd88'; ctx.shadowBlur=4+pulse*6;
    ctx.fillStyle='#ffdd88'; ctx.beginPath(); ctx.arc(bx,by+2,2,0,7); ctx.fill();
    ctx.restore();
  }
}
function drawFountainSpray(f, t) {
  const s = iso(f.gx, f.gy); const cx = s.x, cy = s.y - 16;
  const count = 7, cycle = 1100;
  for (let i = 0; i < count; i++) {
    const p = ((t + i * (cycle / count)) % cycle) / cycle;
    const angle = i * (Math.PI * 2 / count);
    const r = p * 13;
    const rise = -34 * Math.sin(p * Math.PI);
    const x = cx + Math.cos(angle) * r;
    const y = cy + rise + Math.sin(angle) * r * 0.35;
    ctx.fillStyle = (i % 3 === 0) ? '#ffffff' : '#88ccff';
    ctx.globalAlpha = 0.85 * (1 - p * 0.4);
    ctx.beginPath(); ctx.arc(x, y, 2 + (1 - p) * 1, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawTvFlicker(f, t) {
  const s = iso(f.gx, f.gy);
  const sx = s.x - 17, sy = s.y - 27, w = 34, h = 18;
  const channel = Math.floor(t / 160);
  const hue = (channel * 47) % 360, light = 45 + (channel * 31 % 20);
  ctx.save();
  ctx.globalAlpha = 0.55; ctx.fillStyle = `hsl(${hue}, 80%, ${light}%)`;
  ctx.fillRect(sx, sy, w, h);
  ctx.globalAlpha = 0.25; ctx.shadowColor = `hsl(${hue}, 80%, 60%)`; ctx.shadowBlur = 14;
  ctx.fillRect(sx, sy, w, h);
  ctx.restore();
}
function drawComputerGlow(f, t) {
  const s = iso(f.gx, f.gy);
  const sx = s.x - 10, sy = s.y - 25, w = 20, h = 14;
  const phase = (f.gx + f.gy) * 300;
  const pulse = 0.5 + 0.5 * Math.sin((t + phase) / 2000 * Math.PI * 2);
  ctx.save();
  ctx.globalAlpha = 0.25 + pulse * 0.35; ctx.fillStyle = '#aaccff';
  ctx.fillRect(sx, sy, w, h);
  ctx.restore();
}
function drawStoveShimmer(f, t) {
  const s = iso(f.gx, f.gy);
  [[-9,-4],[9,-4],[-9,6]].forEach(([dx,dy], i) => {
    const pulse = 0.5 + 0.5 * Math.sin(t / 500 + i * 2);
    ctx.save();
    ctx.globalAlpha = 0.75; ctx.fillStyle = pulse > 0.5 ? '#ff6600' : '#cc2200';
    ctx.beginPath(); ctx.arc(s.x + dx, s.y + dy, 2.5 + pulse * 1.2, 0, 7); ctx.fill();
    ctx.restore();
  });
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
const evictedIds = new Map(); // id -> timestamp; cegah presence sync basi nge-resurrect player yang baru ganti room

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
  socket.on('change-room', (data) => {
    if (data.newRoom !== currentRoomId) { others.delete(data.id); evictedIds.set(data.id, performance.now()); }
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
    if (ch !== channel) return; // event basi dari channel room lama, sudah diganti
    const st = ch.presenceState(); const live = new Set();
    Object.entries(st).forEach(([id,arr]) => { if(id===myId) return; const v=arr[0]; live.add(id);
      if (!others.has(id)) {
        if (evictedIds.has(id)) {
          if (performance.now() - evictedIds.get(id) < 5000) return; // masih cooldown, skip re-add
          evictedIds.delete(id); // cooldown abis, izinkan re-add
        }
        others.set(id, newPlayer({id, name:v.name, av:v.av,
          ...(v.fx != null ? {fx:v.fx, fy:v.fy, tx:v.fx, ty:v.fy, posSet:true} : {})}));
      }
      else { const o=others.get(id); o.name=v.name; o.av=v.av; } });
    [...others.keys()].forEach(id => { if (!live.has(id)) others.delete(id); });
    [...evictedIds.keys()].forEach(id => { if (!live.has(id)) evictedIds.delete(id); }); // presence udah konfirmasi id ini bener-bener absen
    if (Object.keys(st).length > 0) lastPresenceSuccess = performance.now();
    updateCount();
  });
  ch.on('broadcast', {event:'chat'}, ({payload}) => { if (ch !== channel) return; let o=others.get(payload.id);
    if (o) { say(o, payload.text); } addLog(payload.name, payload.text, false); });
  ch.on('broadcast', {event:'emote'}, ({payload}) => { if (ch !== channel) return; const o=others.get(payload.id); if(o) spawnHearts(o); });

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
  try { await Promise.race([ ch.untrack(), new Promise(r => setTimeout(r, 800)) ]); } catch(e) {}
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
function fadeTransition(show) {
  const el = document.getElementById('roomFade');
  if (!el) return;
  el.classList.toggle('show', show);
}
async function enterRoom(roomId, fromSide) {
  fadeTransition(true);
  doorArmed = false;
  currentRoomId = roomId;
  if (roomId === 'stadium') initStadiumBall();
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
    others.clear();
    updateCount();
    await cleanupChannel(); // di-cap 800ms via Promise.race, gak nunggu tanpa batas
    setupChannel();
    if (socket) { socket.emit('join-room', currentRoomId); socket.emit('change-room', { id: myId, newRoom: currentRoomId }); }
  } else {
    others.clear();
    updateCount();
  }
  fadeTransition(false);
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