// ===== PUSH: 5x5 sliding-cube line game (Quixo rules) =====
(function(){
const LINES = [];
for(let i=0;i<5;i++){ LINES.push([0,1,2,3,4].map(k=>i*5+k)); LINES.push([0,1,2,3,4].map(k=>k*5+i)); }
LINES.push([0,6,12,18,24]); LINES.push([4,8,12,16,20]);
const BORDER = [];
for(let i=0;i<25;i++){ const r=i/5|0, c=i%5; if(r===0||r===4||c===0||c===4) BORDER.push(i); }
const WIN = 1e6;

function dests(i){ const r=i/5|0, c=i%5, s=new Set([r*5, r*5+4, c, 20+c]); s.delete(i); return [...s]; }
function legalFrom(board, p, i){ return BORDER.includes(i) && (board[i].s === -1 || board[i].s === p); }
function moves(board, p){ const m=[]; for(const i of BORDER) if(legalFrom(board,p,i)) for(const d of dests(i)) m.push({from:i,to:d}); return m; }
function slide(board, from, to, p){
  const b = board.slice(), r=from/5|0, c=from%5, r2=to/5|0, c2=to%5;
  const cube = {id:b[from].id, s:p};
  if(r2===r){ if(c2<c){ for(let k=c;k>c2;k--) b[r*5+k]=b[r*5+k-1]; } else { for(let k=c;k<c2;k++) b[r*5+k]=b[r*5+k+1]; } }
  else      { if(r2<r){ for(let k=r;k>r2;k--) b[k*5+c]=b[(k-1)*5+c]; } else { for(let k=r;k<r2;k++) b[k*5+c]=b[(k+1)*5+c]; } }
  b[to] = cube; return b;
}
function lineOf(board, p){ return LINES.find(L => L.every(i => board[i].s === p)) || null; }
function result(board, mover){
  const o = 1-mover, lo = lineOf(board, o); if(lo) return {w:o, line:lo, self:true};
  const lm = lineOf(board, mover); if(lm) return {w:mover, line:lm, self:false};
  return null;
}
function heur(board, p){
  let s = 0; const o = 1-p;
  for(const L of LINES){
    let a=0, b=0; for(const i of L){ const v=board[i].s; if(v===p) a++; else if(v===o) b++; }
    if(b===0) s += a*a*(a>=4?4:1);
    if(a===0) s -= b*b*(b>=4?4:1);
  }
  if(board[12].s===p) s+=2; else if(board[12].s===o) s-=2;
  return s;
}
function arrow(from, to){ const r=from/5|0, r2=to/5|0, c2=to%5; if(r2===r) return c2===0?'→':'←'; return r2===0?'↓':'↑'; }

function negamax(board, p, depth, alpha, beta){
  let kids = moves(board, p).map(m => slide(board, m.from, m.to, p));
  if(depth>=2) kids = kids.map(b=>({b, h:heur(b,p)})).sort((x,y)=>y.h-x.h).map(x=>x.b);
  let best = -Infinity;
  for(const b of kids){
    const r = result(b, p);
    let v;
    if(r) v = r.w===p ? WIN+depth : -WIN-depth;
    else if(depth<=1) v = heur(b, p);
    else v = -negamax(b, 1-p, depth-1, -beta, -alpha);
    if(v>best) best=v;
    if(best>alpha) alpha=best;
    if(alpha>=beta) break;
  }
  return best===-Infinity ? 0 : best;
}

const Game = {
  id:'push', name:'PUSH', _depth:3,
  newState(starter){
    return { board: Array.from({length:25}, (_,i)=>({id:i, s:-1})), turn:starter, winner:null, winLine:null, reason:'', last:null };
  },
  apply(st, m){
    const p = st.turn, board = slide(st.board, m.from, m.to, p), r = result(board, p);
    return { board, turn: r ? p : 1-p, winner: r ? r.w : null, winLine: r ? r.line : null,
      reason: r ? (r.self ? 'self' : 'line') : '', last: m.to, movedId: st.board[m.from].id };
  },
  validMove(st, m){ return m && legalFrom(st.board, st.turn, m.from) && dests(m.from).includes(m.to); },
  ai(st, level){
    const p = st.turn, ms = moves(st.board, p);
    const scored = ms.map(m => { const b = slide(st.board, m.from, m.to, p); return {m, b, r: result(b,p)}; });
    const wins = scored.filter(x => x.r && x.r.w===p);
    const safe = scored.filter(x => !(x.r && x.r.w!==p));
    if(level===0){
      if(wins.length && Math.random()<0.6) return wins[0].m;
      const pool = safe.length ? safe : scored;
      // mild preference for decent moves
      pool.sort((a,b)=>heur(b.b,p)-heur(a.b,p));
      const k = Math.min(pool.length, 10);
      return pool[Math.random()*k|0].m;
    }
    if(wins.length) return wins[0].m;
    if(level===1){
      let best=null, bs=-Infinity;
      for(const x of safe.length?safe:scored){
        let worst = Infinity;
        for(const m2 of moves(x.b, 1-p)){
          const b2 = slide(x.b, m2.from, m2.to, 1-p), r2 = result(b2, 1-p);
          const v = r2 ? (r2.w===1-p ? -WIN : WIN) : heur(b2, p);
          if(v<worst) worst=v; if(worst<=-WIN) break;
        }
        const sc = worst + Math.random()*3;
        if(sc>bs){ bs=sc; best=x.m; }
      }
      return best || scored[0].m;
    }
    // level 2: 4-ply negamax with move ordering
    const ordered = (safe.length?safe:scored).map(x=>({...x, h:heur(x.b,p)+Math.random()*1.5})).sort((a,b)=>b.h-a.h);
    let best=null, bs=-Infinity, alpha=-Infinity;
    for(const x of ordered){
      const v = -negamax(x.b, 1-p, Game._depth, -Infinity, -alpha);
      if(v>bs){ bs=v; best=x.m; }
      if(bs>alpha) alpha=bs;
    }
    return best || scored[0].m;
  },
  reasonText(st, names){
    if(st.reason==='self') return names[1-st.winner]+' malah bikin garis 5 buat '+names[st.winner]+'.';
    return 'Lima berjajar!';
  },
  hint(st, sel){ return sel==null ? 'Pilih kubus pinggir yang kosong atau warnamu.' : 'Pilih ujung berpanah buat dorong masuk.'; },

  /* ---------- view ---------- */
  _els:null, _sel:null, _ctrl:null, _grid:null,
  mount(stage, ctrl){
    this._ctrl = ctrl; this._sel = null; this._els = {};
    stage.innerHTML = '<div class="pp-grid"></div>';
    this._grid = stage.firstChild;
    for(let id=0; id<25; id++){
      const d = document.createElement('div');
      d.className = 'pp-cube'; d.innerHTML = '<div class="pp-face"></div>';
      d.addEventListener('click', ()=>this._tap(id));
      d.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); this._tap(id); } });
      this._els[id] = d; this._grid.appendChild(d);
    }
  },
  extra(){ return ''; },
  _tap(id){
    const c = this._ctrl, st = c.state();
    if(!c.canAct()) return;
    const i = st.board.findIndex(x=>x.id===id);
    if(this._sel===i){ this._sel=null; Pix.Sound.tap(); }
    else if(legalFrom(st.board, st.turn, i)){ this._sel=i; Pix.Sound.select(); Pix.Haptic.tick(8); }
    else { this._sel=null; Pix.Sound.error(); }
    c.refresh();
  },
  get selected(){ return this._sel; },
  clearSel(){ this._sel = null; },
  preview(st, m){ const el = this._els[st.board[m.from].id]; if(el){ el.classList.add('sel'); } },
  render(st, canAct){
    if(!canAct) this._sel = null;
    const els = this._els;
    st.board.forEach((cube, i)=>{
      const el = els[cube.id], r=i/5|0, c=i%5;
      el.style.left = c*20+'%'; el.style.top = r*20+'%';
      el.classList.toggle('s0', cube.s===0); el.classList.toggle('s1', cube.s===1);
      const pick = canAct && legalFrom(st.board, st.turn, i);
      el.classList.toggle('pick', pick);
      el.classList.toggle('sel', this._sel===i);
      el.classList.toggle('dim', this._sel!==null && this._sel!==i);
      el.classList.toggle('last', st.last===i && this._sel===null);
      el.classList.toggle('win', !!(st.winLine && st.winLine.includes(i)));
      el.tabIndex = pick ? 0 : -1;
      el.setAttribute('role', pick ? 'button' : 'img');
      el.setAttribute('aria-label', 'Baris '+(r+1)+' kolom '+(c+1)+': '+(cube.s===-1?'kosong':cube.s===0?'oranye':'tosca'));
    });
    this._grid.querySelectorAll('.pp-target').forEach(t=>t.remove());
    if(this._sel!==null && canAct){
      for(const d of dests(this._sel)){
        const b = document.createElement('button');
        b.className = 'pp-target'; b.style.left=(d%5)*20+'%'; b.style.top=(d/5|0)*20+'%';
        b.setAttribute('aria-label','Dorong ke baris '+((d/5|0)+1)+' kolom '+(d%5+1));
        b.innerHTML = '<span>'+arrow(this._sel,d)+'</span>';
        const from = this._sel;
        b.addEventListener('click', e=>{ e.stopPropagation(); this._sel=null; this._ctrl.commit({from, to:d}); });
        this._grid.appendChild(b);
      }
    }
  },
  animateMove(st){
    const el = this._els[st.movedId]; if(!el) return;
    el.classList.add('moving'); setTimeout(()=>el.classList.remove('moving'), 300);
    Pix.Sound.slide();
  },
  unmount(){ this._els=null; this._grid=null; this._sel=null; },
  validState(s){ return s && Array.isArray(s.board) && s.board.length===25 && s.board.every(c=>c && typeof c.id==='number' && (c.s===-1||c.s===0||c.s===1)); },
  _test:{ slide, result, moves }
};
window.Games = window.Games || {}; window.Games.push = Game;
})();
