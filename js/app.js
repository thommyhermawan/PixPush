// ===== PixPush app controller =====
(function(){
const { Native, CFG, $, Store, Settings, saveSettings, Sound, Haptic, Ads, toast, openSheet, closeSheet, confirmSheet, showScreen, Net } = Pix;
const LEVELS = ['Mudah','Sedang','Sulit'];
const COLOR = ['Oranye','Tosca'];

const C = { game:null, mode:'cpu', level:Settings.level, st:null, history:[], score:[0,0], starter:0, mySide:0, busy:false, undos:0, overShown:false, online:false };

/* ---------- queries the game modules use ---------- */
const ctrl = {
  state: () => C.st,
  canAct,
  commit: m => commit(m),
  refresh: () => render(),
  flip: () => C.mode==='online' && C.mySide===1,
  names
};
function names(){
  if(C.mode==='cpu') return ['Kamu','Komputer'];
  if(C.mode==='online') return C.mySide===0 ? ['Kamu','Lawan'] : ['Lawan','Kamu'];
  return COLOR.slice();
}
function canAct(){
  if(!C.st || C.busy || C.st.winner!=null) return false;
  if(C.mode==='cpu') return C.st.turn===0;
  if(C.mode==='online') return Net.connected() && C.st.turn===C.mySide;
  return true;
}

/* ---------- game lifecycle ---------- */
function mountGame(id){
  if(C.game && C.game.unmount) C.game.unmount();
  C.game = window.Games[id];
  C.game.mount($('stage'), ctrl, $('g-extra'));
}
function beginGame(mode, gameId){
  C.mode = mode; C.score = [0,0]; C.starter = 0; C.mySide = 0;
  mountGame(gameId || Settings.game);
  C.st = C.game.newState(0); C.history = []; C.undos = 0; C.overShown = false; C.busy = false;
  showScreen('scr-game');
  render();
  if(!Settings.seenRules[C.game.id] && mode!=='online'){ Settings.seenRules[C.game.id] = true; saveSettings(); openRules(C.game.id); }
}
function newRound(){
  C.starter = 1 - C.starter;
  C.st = C.game.newState(C.starter); C.history = []; C.undos = 0; C.overShown = false; C.busy = false;
  C.game.clearSel();
  if(C.mode==='online') sendState();
  render(); maybeCpu();
}
function commit(m){
  if(!canAct() || !C.game.validMove(C.st, m)){ Sound.error(); return; }
  C.history.push(C.st);
  finishMove(m);
}
function finishMove(m){
  C.st = C.game.apply(C.st, m);
  if(C.st.winner!=null) C.score[C.st.winner]++;
  Haptic.tick(10);
  C.game.animateMove(C.st);
  if(C.mode==='online') sendState();
  afterMove();
}
function afterMove(){
  render();
  if(C.st.winner!=null){ if(!C.overShown){ C.overShown = true; setTimeout(gameOver, 650); } return; }
  maybeCpu();
}
function maybeCpu(){
  if(C.mode!=='cpu' || C.st.winner!=null || C.st.turn!==1) return;
  C.busy = true; render();
  setTimeout(()=>{
    const m = C.game.ai(C.st, C.level);
    C.game.preview(C.st, m);
    setTimeout(()=>{ C.busy = false; C.history.push(C.st); finishMove(m); }, 260);
  }, 380);
}
function gameOver(){
  const w = C.st.winner, nm = names();
  if(C.mode==='cpu'){
    const s = Store.get('stats', {}); const k = C.game.id+':'+C.level; const v = s[k] || [0,0];
    if(w===0) v[0]++; else v[1]++; s[k] = v; Store.set('stats', s);
  }
  const iWon = C.mode==='local' ? true : (C.mode==='cpu' ? w===0 : w===C.mySide);
  iWon ? Sound.win() : Sound.lose();
  $('over-badge').className = 'over-badge p'+w;
  $('over-h').textContent = (C.mode==='local' ? COLOR[w] : nm[w]) + ' menang!';
  $('over-sub').textContent = C.game.reasonText(C.st, C.mode==='local' ? COLOR : nm) + '  Skor ' + C.score[0] + ' : ' + C.score[1] + '.';
  $('over-again').disabled = C.mode==='online' && !Net.connected();
  openSheet('sheet-over');
}

/* ---------- render ---------- */
function render(){
  if(!C.st) return;
  const act = canAct();
  C.game.render(C.st, act);
  const nm = names(), st = C.st;
  const who = st.winner!=null ? st.winner : st.turn;
  $('turn-chip').className = 'turn-chip p'+who;
  $('status').classList.toggle('thinking', C.busy && C.mode==='cpu');
  let main, sub;
  if(C.mode==='online' && !Net.connected()){
    main = Net.host ? 'Nunggu lawan…' : 'Nyambung…';
    sub = Net.host ? 'Kirim kode '+Net.code+' ke temanmu.' : 'Sebentar ya.';
  } else if(st.winner!=null){
    main = (C.mode==='local' ? COLOR[st.winner] : nm[st.winner]) + ' menang!';
    sub = C.game.reasonText(st, C.mode==='local' ? COLOR : nm);
  } else if(C.mode==='cpu' && st.turn===1){
    main = 'Komputer mikir…'; sub = 'Level '+LEVELS[C.level]+'.';
  } else if(C.mode==='online' && st.turn!==C.mySide){
    main = 'Giliran lawan'; sub = 'Tunggu dia jalan.';
  } else {
    main = C.mode==='local' ? 'Giliran '+COLOR[st.turn] : 'Giliran kamu';
    sub = C.game.hint(st, C.game.selected);
  }
  $('msg-main').textContent = main; $('msg-sub').textContent = sub;
  $('scoreboard').innerHTML =
    '<span class="sc"><span class="sw p0"></span><span class="nm"></span></span><span>'+C.score[0]+' : '+C.score[1]+'</span><span class="sc"><span class="nm"></span><span class="sw p1"></span></span>';
  const nms = $('scoreboard').querySelectorAll('.nm'); nms[0].textContent = nm[0]; nms[1].textContent = nm[1];
  $('g-undo').hidden = C.mode==='online';
  $('g-undo').disabled = !C.history.length || C.busy || (C.mode==='cpu' && !C.history.some(s=>s.turn===0));
  $('g-restart').disabled = C.busy || (C.mode==='online' && (st.winner==null || !Net.connected()));
  $('room-row').hidden = C.mode!=='online';
  $('room-code').textContent = Net.code || '----';
}

/* ---------- undo / restart ---------- */
function doUndo(){
  if(C.st.winner!=null){ const w = C.st.winner; C.score[w] = Math.max(0, C.score[w]-1); }
  if(C.mode==='cpu'){ while(C.history.length){ const s = C.history.pop(); if(s.turn===0){ C.st = s; break; } } }
  else C.st = C.history.pop();
  if(C.st.winner==null && C.overShown){ C.overShown = false; }
  C.undos++; C.game.clearSel(); Sound.tap(); render();
}
$('g-undo').onclick = () => {
  if(!C.history.length || C.busy || C.mode==='online') return;
  if(C.undos < CFG.FREE_UNDOS_PER_GAME || !Ads.enabled){ doUndo(); return; }
  Ads.reward('undo',
    show => confirmSheet('Undo lagi?', 'Undo gratis udah kepakai. Tonton iklan pendek buat undo.', 'Tonton iklan', show),
    () => doUndo(),
    () => toast('Undo dibatalkan.'));
};
$('g-restart').onclick = () => {
  if(C.busy) return;
  const inProgress = C.history.length && C.st.winner==null;
  if(C.mode==='online'){ if(C.st.winner!=null) Ads.next('rematch', newRound); return; }
  if(inProgress) confirmSheet('Ulang game ini?', 'Papan dikosongin dan game baru dimulai.', 'Ulang', ()=>Ads.next('restart', newRound));
  else Ads.next('restart', newRound);
};
$('over-again').onclick = () => { closeSheet(true); Ads.next('game-over', newRound); };
$('over-menu').onclick = () => { closeSheet(true); leaveGame(); };

/* ---------- navigation ---------- */
function leaveGame(){
  if(C.mode==='online') Net.close();
  if(C.game && C.game.unmount) C.game.unmount();
  C.st = null; C.game = null;
  try{ history.replaceState(null, '', location.pathname + location.search); }catch(e){}
  goHome();
}
$('g-back').onclick = () => {
  if(C.mode==='online' && Net.connected()) confirmSheet('Keluar dari room?', 'Lawanmu bakal keputus.', 'Keluar', leaveGame);
  else if(C.history.length && C.st && C.st.winner==null && C.mode!=='online') confirmSheet('Balik ke menu?', 'Game yang lagi jalan bakal hilang.', 'Ke menu', leaveGame);
  else leaveGame();
};
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { Net.close(); goHome(); });

function goHome(){ renderHome(); showScreen('scr-home'); }
function renderHome(){
  document.querySelectorAll('.game-card').forEach(b => b.setAttribute('aria-checked', b.dataset.game===Settings.game));
  document.querySelectorAll('#level button').forEach(b => b.setAttribute('aria-checked', +b.dataset.level===C.level));
  const s = Store.get('stats', {}), v = s[Settings.game+':'+C.level];
  $('stats').textContent = v ? 'Rekor '+window.Games[Settings.game].name+' lawan komputer '+LEVELS[C.level]+': '+v[0]+' menang · '+v[1]+' kalah' : 'Belum ada rekor '+window.Games[Settings.game].name+' lawan komputer '+LEVELS[C.level]+'.';
}
document.querySelectorAll('.game-card').forEach(b => b.onclick = () => { Settings.game = b.dataset.game; saveSettings(); Sound.tap(); renderHome(); });
document.querySelectorAll('#level button').forEach(b => b.onclick = () => { C.level = +b.dataset.level; Settings.level = C.level; saveSettings(); Sound.tap(); renderHome(); });
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {
  Sound.select();
  const m = b.dataset.mode;
  if(m==='online'){ openLobby(); return; }
  beginGame(m);
});

/* ---------- rules & settings ---------- */
function openRules(id){
  id = id || (C.game ? C.game.id : Settings.game);
  document.querySelectorAll('#rules-tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.rules===id));
  $('rules-push').hidden = id!=='push'; $('rules-wall').hidden = id!=='wall';
  openSheet('sheet-rules');
}
document.querySelectorAll('#rules-tabs button').forEach(b => b.onclick = () => openRules(b.dataset.rules));
$('btn-rules').onclick = () => openRules();
$('g-help').onclick = () => openRules();
$('btn-settings').onclick = () => {
  $('set-sound').checked = Settings.sound; $('set-vibe').checked = Settings.vibe;
  $('set-version').textContent = 'PixPush versi ' + CFG.VERSION;
  openSheet('sheet-settings');
};
$('set-sound').onchange = e => { Settings.sound = e.target.checked; saveSettings(); if(Settings.sound) Sound.select(); };
$('set-vibe').onchange = e => { Settings.vibe = e.target.checked; saveSettings(); Haptic.tick(20); };
$('set-reset').onclick = () => confirmSheet('Hapus statistik?', 'Semua rekor menang dan kalah lawan komputer dihapus.', 'Hapus', () => { Store.set('stats', {}); renderHome(); toast('Statistik dihapus.'); });
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => closeSheet());
$('scrim').onclick = () => { if(!$('sheet-over').hidden) return; closeSheet(); };
document.addEventListener('keydown', e => { if(e.key==='Escape' && $('sheet-over').hidden) closeSheet(); });

/* ---------- online ---------- */
function note(t, err){ const p = $('on-note'); p.textContent = t; p.classList.toggle('err', !!err); }
function openLobby(code){
  $('lobby-title').textContent = 'Online · ' + window.Games[Settings.game].name;
  note('Halaman pembuat room harus tetap kebuka selama main.');
  showScreen('scr-lobby');
  if(code){ $('on-code').value = code; joinRoom(code); }
}
function sendState(){ Net.send({t:'state', game:C.game.id, st:C.st, score:C.score, starter:C.starter}); }
Net.on({
  open(){
    if(Net.host){
      Net.send({t:'hello', game:C.game.id, st:C.st, score:C.score, starter:C.starter});
      toast('Lawan udah masuk. Ayo main!'); Sound.select();
    }
    render();
  },
  data(d){
    if(d.t==='full'){ Net.close(); note('Room itu udah penuh.', true); showScreen('scr-lobby'); return; }
    if(d.t==='hello' || d.t==='state'){
      const g = window.Games[d.game]; if(!g || !g.validState(d.st)) return;
      if(d.t==='hello' || !C.game || C.game.id!==d.game){
        C.mode = 'online'; C.mySide = Net.host ? 0 : 1;
        mountGame(d.game); C.history = []; C.undos = 0;
        showScreen('scr-game');
        if(d.t==='hello'){ toast('Nyambung! Kamu main sebagai '+COLOR[C.mySide]+'.'); Sound.select(); }
      }
      const prevLast = C.st && C.st.last;
      C.st = d.st; C.score = Array.isArray(d.score) ? d.score : [0,0]; C.starter = d.starter|0;
      if(C.st.last && JSON.stringify(C.st.last)!==JSON.stringify(prevLast)) C.game.animateMove(C.st);
      if(C.st.winner==null) C.overShown = false;
      C.game.clearSel();
      afterMove();
    }
  },
  close(){
    if(Net.host){ toast('Lawan keluar. Room masih kebuka, dia bisa gabung lagi.', 3200); render(); }
    else { const code = Net.code; Net.close(); closeSheet(true); openLobby(); $('on-code').value = code || ''; note('Sambungan putus. Tap Gabung buat masuk lagi.', true); }
  }
});
$('on-create').onclick = () => {
  if(!Net.ready()){ note('Fitur online belum siap. Cek internet lalu coba lagi.', true); return; }
  $('on-create').disabled = true; note('Bikin room…');
  Net.create(code => {
    $('on-create').disabled = false;
    try{ history.replaceState(null, '', '#'+code); }catch(e){}
    beginGame('online');
  }, () => { $('on-create').disabled = false; note('Gagal bikin room. Cek internet lalu coba lagi.', true); });
};
function joinRoom(code){
  code = (code||'').trim().toUpperCase();
  if(!/^[A-Z0-9]{4}$/.test(code)){ note('Kode room harus 4 huruf atau angka.', true); return; }
  if(!Net.ready()){ setTimeout(()=>joinRoom(code), 600); note('Nyiapin koneksi…'); return; }
  $('on-join').disabled = true; note('Nyambung ke room '+code+'…');
  Net.join(code, () => { $('on-join').disabled = false; }, e => {
    $('on-join').disabled = false;
    note(e && e.type==='peer-unavailable' ? 'Room '+code+' nggak ketemu. Cek kodenya, atau pastikan pembuat room masih buka halamannya.' : 'Gagal nyambung. Cek internet lalu coba lagi.', true);
    Net.close();
  });
}
$('on-join').onclick = () => joinRoom($('on-code').value);
$('on-code').addEventListener('keydown', e => { if(e.key==='Enter') joinRoom($('on-code').value); });
$('room-share').onclick = async () => {
  const code = Net.code; if(!code) return;
  const base = (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ? (CFG.WEB_URL || '') : location.href.split('#')[0];
  const url = base ? base + '#' + code : '';
  const text = 'Main PixPush bareng aku! Kode room: ' + code;
  if(navigator.share){ try{ await navigator.share({title:'PixPush', text, url: url || undefined}); return; }catch(e){ if(e && e.name==='AbortError') return; } }
  try{ await navigator.clipboard.writeText(url ? text+' '+url : text); toast('Link room tersalin.'); }
  catch(e){ toast('Kode room: '+code, 3500); }
};

/* ---------- install prompt (web) ---------- */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; $('btn-install').hidden = false; });
$('btn-install').onclick = async () => { if(!deferredPrompt) return; deferredPrompt.prompt(); try{ await deferredPrompt.userChoice; }catch(e){} deferredPrompt = null; $('btn-install').hidden = true; };
if('serviceWorker' in navigator && location.protocol==='https:' && !Pix.Native.isNative){ window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{})); }

/* ---------- native back button (Android app) ---------- */
document.addEventListener('pixpush:back', () => {
  if(!$('scrim').hidden){ if($('sheet-over').hidden) closeSheet(); return; }
  if(!$('scr-game').hidden){ $('g-back').click(); return; }
  if(!$('scr-lobby').hidden){ Net.close(); goHome(); return; }
  document.dispatchEvent(new Event('pixpush:exit'));
});

/* ---------- native app hooks ---------- */
if(Pix.Native.isNative){
  const App = Pix.Native.plugin('App');
  if(App){
    App.addListener('backButton', () => document.dispatchEvent(new Event('pixpush:back')));
    document.addEventListener('pixpush:exit', () => { try{ App.exitApp(); }catch(e){} });
  }
  $('btn-install').hidden = true;
}

/* ---------- boot ---------- */
Ads.init();
goHome();
const h = (location.hash||'').slice(1).toUpperCase();
if(/^[A-Z0-9]{4}$/.test(h)) openLobby(h);
window.PixApp = { C, ctrl };
})();
