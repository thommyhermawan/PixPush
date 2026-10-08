// ===== PixPush core: storage, sound, haptics, ads, UI helpers, online link =====
(function(){
const CFG = window.PIX_CONFIG;
const $ = id => document.getElementById(id);

/* ---------- storage ---------- */
const Store = {
  get(k, d){ try{ const v = localStorage.getItem('pixpush:'+k); return v==null ? d : JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem('pixpush:'+k, JSON.stringify(v)); }catch(e){} }
};

/* ---------- settings ---------- */
const Settings = Object.assign({ sound:true, vibe:true, level:1, game:'push', seenRules:{} }, Store.get('settings', {}));
function saveSettings(){ Store.set('settings', Settings); }

/* ---------- chiptune sound ---------- */
let ctx = null, muted = false;
function ac(){
  if(!Settings.sound || muted) return null;
  try{
    if(!ctx){ const A = window.AudioContext || window.webkitAudioContext; if(!A) return null; ctx = new A(); }
    if(ctx.state === 'suspended') ctx.resume();
    return ctx;
  }catch(e){ return null; }
}
function tone(freq, dur, type, vol, when, slideTo){
  const a = ac(); if(!a) return;
  const t = a.currentTime + (when||0);
  const o = a.createOscillator(), g = a.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, t);
  if(slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol||0.06, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
const Sound = {
  tap(){ tone(880, .05, 'square', .04); },
  select(){ tone(660, .06, 'square', .05); tone(990, .06, 'square', .04, .05); },
  slide(){ tone(420, .16, 'square', .05, 0, 180); },
  wall(){ tone(140, .12, 'square', .08); tone(90, .1, 'triangle', .08, .05); },
  error(){ tone(160, .12, 'sawtooth', .05); },
  win(){ [523,659,784,1047].forEach((f,i)=>tone(f, .14, 'square', .06, i*.11)); },
  lose(){ [392,330,262,196].forEach((f,i)=>tone(f, .16, 'square', .05, i*.13)); },
  setMuted(m){ muted = m; }
};
const Haptic = { tick(ms){ if(Settings.vibe && navigator.vibrate){ try{ navigator.vibrate(ms||12); }catch(e){} } } };

/* ---------- ads: AdMob in the native app, AdSense H5 Games Ads on the web ---------- */
const Native = (function(){
  const cap = window.Capacitor;
  const isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  return { isNative, platform: isNative ? cap.getPlatform() : 'web', plugin: name => (isNative && cap.registerPlugin) ? cap.registerPlugin(name) : null };
})();

const Ads = {
  enabled:false, kind:'none', lastFull:0, admob:null, ids:null, interReady:false, rewardReady:false, bannerOn:false,
  init(){
    if(Native.isNative) this._initNative(); else this._initWeb();
  },
  _due(){ return Date.now() - this.lastFull > CFG.AD_EVERY_SECONDS*1000; },

  /* web */
  _initWeb(){
    if(!CFG.ADSENSE_CLIENT) return;
    this.enabled = true; this.kind = 'web';
    window.adsbygoogle = window.adsbygoogle || [];
    window.adBreak = window.adConfig = function(o){ window.adsbygoogle.push(o); };
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(CFG.ADSENSE_CLIENT);
    s.setAttribute('data-ad-client', CFG.ADSENSE_CLIENT);
    s.setAttribute('data-ad-frequency-hint', CFG.AD_EVERY_SECONDS + 's');
    if(CFG.AD_TEST_MODE) s.setAttribute('data-adbreak-test', 'on');
    s.crossOrigin = 'anonymous';
    document.head.appendChild(s);
    window.adConfig({ preloadAdBreaks:'on', sound: Settings.sound ? 'on' : 'off' });
    if(CFG.AD_SLOT_HOME){
      const slot = $('ad-home'); slot.hidden = false;
      slot.innerHTML = '<ins class="adsbygoogle" style="display:block;width:100%" data-ad-client="'+CFG.ADSENSE_CLIENT+'" data-ad-slot="'+CFG.AD_SLOT_HOME+'" data-ad-format="auto" data-full-width-responsive="true"></ins>';
      try{ window.adsbygoogle.push({}); }catch(e){}
    }
  },

  /* native */
  async _initNative(){
    const A = this.admob = Native.plugin('AdMob'); if(!A) return;
    const p = Native.platform, real = CFG.ADMOB[p] || {}, test = CFG.ADMOB_TEST[p] || {};
    this.ids = CFG.AD_TEST_MODE ? test : real;
    if(!this.ids.interstitial && !this.ids.rewarded && !this.ids.banner) return;
    this.enabled = true; this.kind = 'native';
    try{
      if(p==='ios'){
        try{ const t = await A.trackingAuthorizationStatus(); if(t && t.status==='notDetermined') await A.requestTrackingAuthorization(); }catch(e){}
      }
      await A.initialize({ initializeForTesting: !!CFG.AD_TEST_MODE });
      try{
        const info = await A.requestConsentInfo();
        if(info && info.isConsentFormAvailable && info.status==='REQUIRED') await A.showConsentForm();
      }catch(e){}
      A.addListener('bannerAdSizeChanged', size => {
        document.documentElement.style.setProperty('--banner-h', ((size && size.height) || 0) + 'px');
      });
      this._prepInter(); this._prepReward();
      if(this._screen==='scr-home') this.showBanner();
    }catch(e){ this.enabled = false; }
  },
  _prepInter(){ if(!this.ids.interstitial) return; this.interReady = false; this.admob.prepareInterstitial({adId:this.ids.interstitial}).then(()=>{ this.interReady = true; }).catch(()=>{ setTimeout(()=>this._prepInter(), 60000); }); },
  _prepReward(){ if(!this.ids.rewarded) return; this.rewardReady = false; this.admob.prepareRewardVideoAd({adId:this.ids.rewarded}).then(()=>{ this.rewardReady = true; }).catch(()=>{ setTimeout(()=>this._prepReward(), 60000); }); },
  showBanner(){
    if(this.kind!=='native' || !this.ids.banner) return;
    if(this.bannerOn){ this.admob.resumeBanner().catch(()=>{}); return; }
    this.bannerOn = true;
    this.admob.showBanner({ adId:this.ids.banner, adSize:'ADAPTIVE_BANNER', position:'BOTTOM_CENTER', margin:0 }).catch(()=>{ this.bannerOn = false; });
  },
  hideBanner(){ if(this.kind==='native' && this.bannerOn){ this.admob.hideBanner().catch(()=>{}); document.documentElement.style.setProperty('--banner-h','0px'); } },
  onScreen(id){ this._screen = id; if(id==='scr-home') this.showBanner(); else this.hideBanner(); },

  // Full-screen ad between games. Always calls done().
  next(name, done){
    if(!this.enabled || !this._due()){ done(); return; }
    let finished = false; const fin = () => { if(!finished){ finished = true; Sound.setMuted(false); done(); } };
    if(this.kind==='native'){
      if(!this.interReady){ fin(); return; }
      Sound.setMuted(true); this.lastFull = Date.now();
      this.admob.showInterstitial().catch(()=>{}).then(()=>{ this._prepInter(); fin(); });
      return;
    }
    try{
      window.adBreak({ type:'next', name,
        beforeAd: () => { Sound.setMuted(true); this.lastFull = Date.now(); },
        afterAd(){ Sound.setMuted(false); },
        adBreakDone: fin });
      setTimeout(fin, 8000);
    }catch(e){ fin(); }
  },
  // Rewarded ad. offer(show) asks the player; onReward() runs when earned or when no ad is available.
  reward(name, offer, onReward, onDecline){
    if(!this.enabled){ onReward(); return; }
    if(this.kind==='native'){
      if(!this.rewardReady){ onReward(); return; }
      offer(() => {
        Sound.setMuted(true);
        this.admob.showRewardVideoAd()
          .then(item => { Sound.setMuted(false); this._prepReward(); if(item) onReward(); else if(onDecline) onDecline(); })
          .catch(() => { Sound.setMuted(false); this._prepReward(); onReward(); });
      });
      return;
    }
    let offered = false, rewarded = false;
    try{
      window.adBreak({ type:'reward', name,
        beforeReward(showAdFn){ offered = true; offer(showAdFn); },
        beforeAd(){ Sound.setMuted(true); },
        afterAd(){ Sound.setMuted(false); },
        adDismissed(){ if(onDecline) onDecline(); },
        adViewed(){ rewarded = true; onReward(); },
        adBreakDone(){ if(!offered && !rewarded) onReward(); } });
    }catch(e){ onReward(); }
  }
};

/* ---------- UI helpers ---------- */
let toastTimer = null;
function toast(msg, ms){
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>{ t.hidden = true; }, ms || 2200);
}
let openSheetEl = null, sheetOnClose = null;
function openSheet(id, onClose){
  closeSheet(true);
  openSheetEl = $(id); sheetOnClose = onClose || null;
  $('scrim').hidden = false; openSheetEl.hidden = false;
  const f = openSheetEl.querySelector('button'); if(f) setTimeout(()=>f.focus({preventScroll:true}), 30);
}
function closeSheet(silent){
  if(!openSheetEl) return;
  openSheetEl.hidden = true; $('scrim').hidden = true;
  const cb = sheetOnClose; openSheetEl = null; sheetOnClose = null;
  if(cb && !silent) cb();
}
function confirmSheet(title, sub, yesLabel, onYes){
  $('conf-h').textContent = title; $('conf-sub').textContent = sub; $('conf-yes').textContent = yesLabel;
  $('conf-yes').onclick = () => { closeSheet(true); onYes(); };
  $('conf-no').onclick = () => closeSheet();
  openSheet('sheet-confirm');
}
function showScreen(id){
  for(const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  window.scrollTo(0,0);
  Ads.onScreen(id);
}

/* ---------- online link (PeerJS, peer-to-peer) ---------- */
const Net = {
  peer:null, conn:null, code:null, host:false, handlers:{},
  ready(){ return !!window.Peer; },
  on(h){ this.handlers = h; },
  makeCode(){ const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<4;i++) s+=A[Math.random()*A.length|0]; return s; },
  connected(){ return !!(this.conn && this.conn.open); },
  close(){
    try{ this.conn && this.conn.close(); }catch(e){}
    try{ this.peer && this.peer.destroy(); }catch(e){}
    this.peer = this.conn = this.code = null; this.host = false;
  },
  send(msg){ if(this.connected()){ try{ this.conn.send(msg); return true; }catch(e){} } return false; },
  _wire(c){
    this.conn = c;
    c.on('open', ()=> this.handlers.open && this.handlers.open());
    c.on('data', d => { if(d && typeof d === 'object') this.handlers.data && this.handlers.data(d); });
    c.on('close', ()=> { if(this.conn === c){ this.conn = null; this.handlers.close && this.handlers.close(); } });
    c.on('error', ()=>{});
  },
  create(onReady, onError){
    this.close();
    const code = this.makeCode();
    const p = this.peer = new Peer(CFG.PEER_PREFIX + code);
    p.on('open', ()=>{ this.code = code; this.host = true; onReady(code); });
    p.on('connection', c => {
      if(this.connected()){ c.on('open', ()=>{ c.send({t:'full'}); setTimeout(()=>c.close(), 400); }); return; }
      this._wire(c);
    });
    p.on('error', e => {
      if(e && e.type === 'unavailable-id'){ this.create(onReady, onError); return; }
      if(e && e.type === 'peer-unavailable') return;
      onError(e);
    });
    p.on('disconnected', ()=>{ try{ if(this.peer && !this.peer.destroyed) this.peer.reconnect(); }catch(e){} });
  },
  join(code, onOpenPeer, onError){
    this.close();
    const p = this.peer = new Peer();
    p.on('open', ()=>{ this.code = code; this.host = false; this._wire(p.connect(CFG.PEER_PREFIX + code, {reliable:true})); onOpenPeer(); });
    p.on('error', e => onError(e));
  }
};

window.Pix = { Native, CFG, $, Store, Settings, saveSettings, Sound, Haptic, Ads, toast, openSheet, closeSheet, confirmSheet, showScreen, Net };
})();
