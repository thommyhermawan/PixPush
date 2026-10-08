// Plays computer-vs-computer games for both games and fails on any illegal move.
import fs from 'node:fs';
import vm from 'node:vm';
const ctx = { window: {}, Pix: {}, console };
ctx.window = ctx; vm.createContext(ctx);
for (const f of ['js/push.js', 'js/wall.js']) vm.runInContext(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'), ctx);
let games = 0;
for (const id of ['push', 'wall']) {
  const G = ctx.Games[id];
  for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
    let st = G.newState(0), t = 0;
    while (st.winner == null && t < 200) {
      const m = G.ai(st, st.turn === 0 ? a : b);
      if (!G.validMove(st, m)) { console.error('illegal move', id, JSON.stringify(m)); process.exit(1); }
      st = G.apply(st, m); t++;
    }
    games++;
    console.log(id, `L${a} vs L${b}`, st.winner == null ? 'draw' : 'winner ' + st.winner, t + ' moves');
  }
}
console.log('ok', games, 'games');
