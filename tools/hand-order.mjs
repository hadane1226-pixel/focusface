// 169 스타팅 핸드를 "무작위 핸드 상대 승률" 순으로 정렬한다 (익스 연습장 봇 레인지용)
// 실행: node tools/hand-order.mjs
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const E = require("../exploit/engine.js");
const R = E.RANKS, out = [];
for (let i = 12; i >= 0; i--) for (let j = 12; j >= 0; j--) {
  let hand, cards;
  if (i === j) { hand = R[i] + R[j]; cards = [i * 4, j * 4 + 1]; }
  else if (i > j) { hand = R[i] + R[j] + "s"; cards = [i * 4, j * 4]; }
  else { hand = R[j] + R[i] + "o"; cards = [j * 4, i * 4 + 1]; }
  out.push([hand, E.equity(cards, null, [], 20000)]);
}
out.sort((a, b) => b[1] - a[1]);
console.log(JSON.stringify(out.map(x => x[0])));
console.error(out.slice(0, 10).map(x => x[0] + " " + x[1].toFixed(3)).join(", "), " … ", out.slice(-3).map(x => x[0] + " " + x[1].toFixed(3)).join(", "));
