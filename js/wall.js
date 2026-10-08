// ===== WALL: 9x9 race-and-block game (Quoridor rules, 2 players) =====
(function(){
const N = 9, W = 8, WALLS = 10, WIN = 1e6;
const DIRS = [[-1,0],[1,0],[0,-1],[0,1]];
const goalRow = p => p===0 ? 0 : 8;

function blocked(H, V, r, c, dr, dc){
  if(dr===1){ if(r>=8) return true; return (c<=7 && H[r*W+c]) || (c>=1 && H[r*W+c-1]); }
  if(dr===-1){ if(r<=0) return true; const rr=r-1; return (c<=7 && H[rr*W+c]) || (c>=1 && H[rr*W+c-1]); }
  if(dc===1){ if(c>=8) return true; return (r<=7 && V[r*W+c]) || (r>=1 && V[(r-1)*W+c]); }
  if(dc===-1){ if(c<=0) return true; const cc=c-1; return (r<=7 && V[r*W+cc]) || (r>=1 && V[(r-1)*W+cc]); }
  return true;
}
// shortest path length (ignoring pawns); returns {d, path}
function bfs(H, V, from, p, wantPath){
  const g = goalRow(p), start = from.r*N+from.c;
  if(from.r===g) return {d:0, path:[start]};
  const prev = new Int16Array(81).fill(-2); prev[start] = -1;
  const q = [start]; let head = 0;
  while(head < q.length){
    const cur = q[head++], r = cur/N|0, c = cur%N;
    for(const [dr,dc] of DIRS){
      if(blocked(H,V,r,c,dr,dc)) continue;
      const n = (r+dr)*N + (c+dc);
      if(prev[n] !== -2) continue;
      prev[n] = cur;
      if(r+dr === g){
        let d = 0, path = wantPath ? [n] : null, x = n;
        while(prev[x] !== -1){ x = prev[x]; d++; if(wantPath) path.push(x); }
        return {d, path: wantPath ? path.reverse() : null};
      }
      q.push(n);
    }
  }
  return {d: Infinity, path: null};
}
const dist = (st, p) => bfs(st.H, st.V, st.pos[p], p, false).d;

function pawnMoves(st, p){
  const me = st.pos[p], op = st.pos[1-p], out = [];
  for(const [dr,dc] of DIRS){
    if(blocked(st.H,st.V,me.r,me.c,dr,dc)) continue;
    const nr = me.r+dr, nc = me.c+dc;
    if(nr===op.r && nc===op.c){
      if(!blocked(st.H,st.V,nr,nc,dr,dc)) out.push({r:nr+dr, c:nc+dc});
      else for(const [er,ec] of (dr!==0 ? [[0,-1],[0,1]] : [[-1,0],[1,0]])){
        if(!blocked(st.H,st.V,nr,nc,er,ec)) out.push({r:nr+er, c:nc+ec});
      }
    } else out.push({r:nr, c:nc});
  }
  return out;
}
function wallFits(st, o, r, c){
  if(r<0||r>7||c<0||c>7) return false;
  const i = r*W+c, H = st.H, V = st.V;
  if(o==='h') return !H[i] && !(c>0 && H[i-1]) && !(c<7 && H[i+1]) && !V[i];
  return !V[i] && !(r>0 && V[i-W]) && !(r<7 && V[i+W]) && !H[i];
}
function withWall(st, o, r, c){
  const H = st.H.slice(), V = st.V.slice();
  (o==='h' ? H : V)[r*W+c] = 1;
  return {H, V};
}
function wallValid(st, p, o, r, c){
  if(st.left[p] <= 0 || !wallFits(st, o, r, c)) return false;
  const {H, V} = withWall(st, o, r, c);
  return bfs(H,V,st.pos[0],0,false).d < Infinity && bfs(H,V,st.pos[1],1,false).d < Infinity;
}
function apply(st, m){
  const p = st.turn;
  const ns = { pos: st.pos.map(x=>({r:x.r, c:x.c})), left: st.left.slice(), H: st.H, V: st.V,
    turn: 1-p, winner: null, reason: '', last: m };
  if(m.type==='m'){
    ns.pos[p] = {r:m.r, c:m.c};
    if(m.r === goalRow(p)){ ns.winner = p; ns.turn = p; ns.reason = 'goal'; }
  } else {
    const w = withWall(st, m.o, m.r, m.c); ns.H = w.H; ns.V = w.V; ns.left[p]--;
  }
  return ns;
}
function evalFor(st, p){
  const dm = dist(st, p), dop = dist(st, 1-p);
  if(dm===0) return WIN; if(dop===0) return -WIN;
  return (dop - dm)*12 + (st.left[p] - st.left[1-p])*2.5 - dm*0.5;
}
// walls that touch the target player's current shortest path
function candidateWalls(st, mover, target){
  if(st.left[mover] <= 0) return [];
  const res = bfs(st.H, st.V, st.pos[target], target, true);
  if(!res.path) return [];
  const seen = new Set(), out = [];
  for(const cell of res.path.slice(0, 7)){
    const r = cell/N|0, c = cell%N;
    for(const [ar,ac] of [[r-1,c-1],[r-1,c],[r,c-1],[r,c]]){
      for(const o of ['h','v']){
        const k = o+ar+','+ac; if(seen.has(k)) continue; seen.add(k);
        if(wallValid(st, mover, o, ar, ac)) out.push({type:'w', o, r:ar, c:ac});
      }
    }
  }
  return out;
}
function allCandidates(st, p){
  return pawnMoves(st, p).map(x=>({type:'m', r:x.r, c:x.c})).concat(candidateWalls(st, p, 1-p));
}

const Game = {
  id:'wall', name:'WALL',
  newState(starter){
    return { pos:[{r:8,c:4},{r:0,c:4}], left:[WALLS,WALLS], H:new Array(64).fill(0), V:new Array(64).fill(0),
      turn:starter, winner:null, reason:'', last:null };
  },
  apply,
  validMove(st, m){
    if(!m) return false;
    if(m.type==='m') return pawnMoves(st, st.turn).some(x=>x.r===m.r && x.c===m.c);
    if(m.type==='w') return (m.o==='h'||m.o==='v') && wallValid(st, st.turn, m.o, m.r, m.c);
    return false;
  },
  ai(st, level){
    const p = st.turn;
    const pm = pawnMoves(st, p).map(x=>({type:'m', r:x.r, c:x.c}));
    const winNow = pm.find(m=>m.r===goalRow(p)); if(winNow) return winNow;
    const stepBest = () => {
      let best = pm[0], bd = Infinity;
      for(const m of pm){ const d = dist(apply(st,m), p); if(d<bd || (d===bd && Math.random()<.5)){ bd=d; best=m; } }
      return best;
    };
    if(level===0){
      if(st.left[p]>0 && Math.random()<0.22){
        const ws = candidateWalls(st, p, 1-p); if(ws.length) return ws[Math.random()*ws.length|0];
      }
      return stepBest();
    }
    const cands = allCandidates(st, p);
    const scored = cands.map(m=>{ const s = apply(st, m); return {m, s, v: evalFor(s, p) + (m.type==='m'?0.6:0) + Math.random()*0.8}; });
    scored.sort((a,b)=>b.v-a.v);
    if(level===1) return scored[0].m;
    // level 2: look at the opponent's best reply
    const top = scored.filter(x=>x.m.type==='m').concat(scored.filter(x=>x.m.type==='w').slice(0, 18));
    let best = scored[0].m, bv = -Infinity;
    for(const x of top){
      const o = 1-p;
      const replies = pawnMoves(x.s, o).map(y=>({type:'m', r:y.r, c:y.c})).concat(candidateWalls(x.s, o, p));
      let worst = Infinity;
      for(const y of replies){
        if(y.type==='m' && y.r===goalRow(o)){ worst = -WIN; break; }
        const v = evalFor(apply(x.s, y), p);
        if(v<worst) worst = v;
      }
      if(worst===Infinity) worst = evalFor(x.s, p);
      const v = worst + (x.m.type==='m'?0.6:0) + Math.random()*0.5;
      if(v>bv){ bv=v; best=x.m; }
    }
    return best;
  },
  reasonText(){ return 'Sampai duluan ke seberang!'; },
  hint(st){ return this._mode==='wall' ? 'Tap papan buat taruh tembok, putar kalau perlu, lalu Pasang.' : 'Tap kotak kuning buat jalan, atau pilih Tembok.'; },

  /* ---------- view ---------- */
  _ctrl:null, _stage:null, _extra:null, _mode:'move', _ghost:null, _o:'h', _cells:null, _pawns:null, _walls:null, _ghostEl:null, _hit:null,
  geo(){ const g = 2.4, s = (100 - 8*g)/9; return {g, s}; },
  mount(stage, ctrl, extraEl){
    this._ctrl = ctrl; this._stage = stage; this._extra = extraEl; this._mode = 'move'; this._ghost = null; this._o = 'h';
    const {g, s} = this.geo();
    stage.innerHTML = '<div class="wl-grid"></div>';
    const grid = stage.firstChild; this._grid = grid;
    this._cells = [];
    for(let i=0;i<81;i++){
      const d = document.createElement('div'); d.className = 'wl-cell';
      const vr = i/N|0, vc = i%N;
      d.style.left = vc*(s+g)+'%'; d.style.top = vr*(s+g)+'%'; d.style.width = s+'%'; d.style.height = s+'%';
      d.addEventListener('click', ()=>this._tapCell(vr, vc));
      grid.appendChild(d); this._cells.push(d);
    }
    this._walls = document.createElement('div'); grid.appendChild(this._walls);
    this._pawns = [0,1].map(p=>{ const d = document.createElement('div'); d.className = 'wl-pawn p'+p; d.innerHTML='<i></i>';
      d.style.width = s+'%'; d.style.height = s+'%'; grid.appendChild(d); return d; });
    this._ghostEl = document.createElement('div'); this._ghostEl.className = 'wl-ghost'; this._ghostEl.hidden = true; grid.appendChild(this._ghostEl);
    this._hit = document.createElement('div'); this._hit.className = 'wl-hit'; grid.appendChild(this._hit);
    this._hit.addEventListener('pointerdown', e=>this._tapHit(e));
    extraEl.innerHTML =
      '<div class="seg" role="radiogroup" aria-label="Aksi" style="flex:1 1 100%">'+
        '<button role="radio" data-wm="move">Jalan</button><button role="radio" data-wm="wall">Tembok</button></div>'+
      '<button class="btn small" data-wa="rot" aria-label="Putar tembok">Putar ↻</button>'+
      '<button class="btn small primary" data-wa="place">Pasang</button>'+
      '<div class="wl-counts"><div class="walls-left" data-wl="0"></div><span class="muted small">sisa tembok</span><div class="walls-left" data-wl="1"></div></div>';
    extraEl.querySelectorAll('[data-wm]').forEach(b=>b.addEventListener('click', ()=>{ this._mode = b.dataset.wm; this._ghost = null; Pix.Sound.tap(); this._ctrl.refresh(); }));
    extraEl.querySelector('[data-wa="rot"]').addEventListener('click', ()=>{ this._o = this._o==='h'?'v':'h'; if(this._ghost){ this._ghost.o = this._o; } Pix.Sound.tap(); this._ctrl.refresh(); });
    extraEl.querySelector('[data-wa="place"]').addEventListener('click', ()=>this._place());
  },
  _flip(){ return this._ctrl.flip(); },
  _toModel(r, c){ return this._flip() ? {r:8-r, c:8-c} : {r, c}; },
  _tapCell(vr, vc){
    const c = this._ctrl; if(!c.canAct() || this._mode!=='move') return;
    const st = c.state(), m = this._toModel(vr, vc);
    if(pawnMoves(st, st.turn).some(x=>x.r===m.r && x.c===m.c)) c.commit({type:'m', r:m.r, c:m.c});
    else Pix.Sound.error();
  },
  _tapHit(e){
    const c = this._ctrl; if(!c.canAct() || this._mode!=='wall') return;
    e.preventDefault();
    const rect = this._grid.getBoundingClientRect(), {g, s} = this.geo();
    const x = (e.clientX - rect.left)/rect.width*100, y = (e.clientY - rect.top)/rect.height*100;
    let ac = Math.round((x + g/2)/(s+g)) - 1, ar = Math.round((y + g/2)/(s+g)) - 1;
    ac = Math.max(0, Math.min(7, ac)); ar = Math.max(0, Math.min(7, ar));
    const m = this._flip() ? {r:7-ar, c:7-ac} : {r:ar, c:ac};
    if(this._ghost && this._ghost.r===m.r && this._ghost.c===m.c){ this._o = this._o==='h'?'v':'h'; }
    this._ghost = {o:this._o, r:m.r, c:m.c};
    Pix.Sound.tap(); Pix.Haptic.tick(6);
    c.refresh();
  },
  _place(){
    const c = this._ctrl, st = c.state();
    if(!c.canAct() || !this._ghost) return;
    const g = this._ghost;
    if(!wallValid(st, st.turn, g.o, g.r, g.c)){ Pix.Sound.error(); Pix.toast(st.left[st.turn]<=0 ? 'Tembokmu udah habis.' : 'Tembok nggak bisa dipasang di situ.'); return; }
    this._ghost = null; this._mode = 'move';
    c.commit({type:'w', o:g.o, r:g.r, c:g.c});
  },
  _wallStyle(o, r, c){
    const {g, s} = this.geo(), f = this._flip();
    const vr = f ? 7-r : r, vc = f ? 7-c : c;
    if(o==='h') return 'left:'+(vc*(s+g))+'%;top:'+((vr+1)*s+vr*g)+'%;width:'+(2*s+g)+'%;height:'+g+'%';
    return 'left:'+((vc+1)*s+vc*g)+'%;top:'+(vr*(s+g))+'%;width:'+g+'%;height:'+(2*s+g)+'%';
  },
  clearSel(){ this._ghost = null; this._mode = 'move'; },
  get selected(){ return this._ghost; },
  preview(){},
  render(st, canAct){
    if(!canAct){ this._ghost = null; }
    const {g, s} = this.geo(), f = this._flip();
    const can = canAct && this._mode==='move' ? pawnMoves(st, st.turn) : [];
    for(let i=0;i<81;i++){
      const vr = i/N|0, vc = i%N, m = f ? {r:8-vr, c:8-vc} : {r:vr, c:vc};
      const el = this._cells[i];
      el.classList.toggle('goal0', m.r===0); el.classList.toggle('goal1', m.r===8);
      el.classList.toggle('can', can.some(x=>x.r===m.r && x.c===m.c));
    }
    st.pos.forEach((p, k)=>{
      const vr = f ? 8-p.r : p.r, vc = f ? 8-p.c : p.c;
      const el = this._pawns[k]; el.style.left = vc*(s+g)+'%'; el.style.top = vr*(s+g)+'%';
    });
    let html = '';
    for(let i=0;i<64;i++){
      const r = i/W|0, c = i%W;
      const isLast = st.last && st.last.type==='w' && st.last.r===r && st.last.c===c;
      if(st.H[i]) html += '<div class="wl-wall'+(isLast && st.last.o==='h'?' last':'')+'" style="'+this._wallStyle('h',r,c)+'"></div>';
      if(st.V[i]) html += '<div class="wl-wall'+(isLast && st.last.o==='v'?' last':'')+'" style="'+this._wallStyle('v',r,c)+'"></div>';
    }
    this._walls.innerHTML = html;
    const gh = this._ghost;
    if(gh && canAct && this._mode==='wall'){
      this._ghostEl.hidden = false;
      this._ghostEl.setAttribute('style', this._wallStyle(gh.o, gh.r, gh.c));
      const ok = wallValid(st, st.turn, gh.o, gh.r, gh.c);
      this._ghostEl.className = 'wl-ghost ' + (ok ? 'ok' : 'bad');
    } else this._ghostEl.hidden = true;
    this._hit.classList.toggle('on', canAct && this._mode==='wall');
    // controls
    const ex = this._extra;
    ex.querySelectorAll('[data-wm]').forEach(b=>{ b.setAttribute('aria-checked', b.dataset.wm===this._mode); b.disabled = !canAct; });
    const wallBtn = ex.querySelector('[data-wm="wall"]'); if(canAct && st.left[st.turn]<=0){ wallBtn.disabled = true; if(this._mode==='wall') this._mode='move'; }
    ex.querySelector('[data-wa="rot"]').hidden = !(canAct && this._mode==='wall');
    const pl = ex.querySelector('[data-wa="place"]'); pl.hidden = !(canAct && this._mode==='wall');
    pl.disabled = !(gh && wallValid(st, st.turn, gh.o, gh.r, gh.c));
    const names = this._ctrl.names();
    ex.querySelectorAll('[data-wl]').forEach(d=>{
      const p = +d.dataset.wl;
      let pips = '<span class="sw p'+p+'"></span>';
      for(let k=0;k<WALLS;k++) pips += '<i class="'+(k<st.left[p]?'':'used')+'"></i>';
      d.innerHTML = pips; d.setAttribute('aria-label', 'Tembok '+names[p]+': '+st.left[p]); d.title = 'Tembok '+names[p]+': '+st.left[p];
    });
  },
  animateMove(st){ if(st.last && st.last.type==='w'){ Pix.Sound.wall(); Pix.Haptic.tick(20); } else Pix.Sound.slide(); },
  unmount(){ if(this._extra) this._extra.innerHTML=''; this._cells=null; },
  validState(s){
    return s && Array.isArray(s.pos) && s.pos.length===2 && Array.isArray(s.H) && s.H.length===64 && Array.isArray(s.V) && s.V.length===64
      && Array.isArray(s.left) && s.pos.every(p=>p && p.r>=0 && p.r<9 && p.c>=0 && p.c<9);
  },
  _test:{ pawnMoves, wallValid, dist, apply }
};
window.Games = window.Games || {}; window.Games.wall = Game;
})();
