// 학습용 근사 오픈 레인지 생성기 (solver 결과 아님)
// 실행: node tools/gen-ranges.mjs > train/ranges.js
// 실제 차트로 바꾸려면 오픈 훈련 페이지의 "차트 보기 → 편집"에서 칠한 뒤 내보내기 하면 된다.

const RANKS = "AKQJT98765432".split("");
const STACKS = [100, 80, 60, 50, 40, 30, 25, 20, 15];
const POSITIONS = ["UTG", "UTG+1", "LJ", "HJ", "CO", "BTN", "SB"];

// 100bb 기준 포지션별 오픈 비율(%)
const BASE_PCT = { "UTG": 17, "UTG+1": 20, "LJ": 24, "HJ": 29, "CO": 37, "BTN": 50, "SB": 42 };
const STACK_MUL = { 100: 1, 80: 1, 60: .98, 50: .97, 40: .95, 30: .93, 25: .92, 20: .92, 15: .95 };

// 입문 블로그 2장의 UTG 100bb 예시와 동일하게 맞춘다
const BLOG_UTG = [
  "AA","KK","QQ","JJ","TT","99","88","77","66","55","44","33","22",
  "AKs","AQs","AJs","ATs","A9s","A8s","A7s","A6s","A5s","A4s","A3s","A2s",
  "KQs","KJs","KTs","QJs","QTs","JTs","T9s","T8s","98s","87s","76s","65s","54s",
  "AKo","AQo","AJo","KQo"
];

const num = r => 14 - RANKS.indexOf(r);
const combos = h => h.length === 2 ? 6 : h[2] === "s" ? 4 : 12;

function allHands() {
  const out = [];
  for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) {
    const hi = RANKS[Math.min(i, j)], lo = RANKS[Math.max(i, j)];
    out.push(i === j ? hi + lo : i < j ? hi + lo + "s" : hi + lo + "o");
  }
  return out;
}

// Chen 공식 + 스택 깊이 보정
function score(h, stack) {
  const a = h[0], b = h[1], pair = h.length === 2, suited = h[2] === "s";
  const hv = { A: 10, K: 8, Q: 7, J: 6 }[a] ?? num(a) / 2;
  let s;
  if (pair) s = Math.max(5, hv * 2);
  else {
    s = hv + (suited ? 2 : 0);
    const gap = num(a) - num(b) - 1;
    s -= [0, 1, 2, 4][gap] ?? 5;
    if (gap <= 1 && num(a) < 12) s += 1;
    if (!suited && num(a) < 13 && num(b) < 9) s -= 1.5; // 낮은 오프수딧은 플레이어빌리티가 나쁘다
  }
  if (stack <= 40) {
    if (pair) s += 1;
    if (!pair && a === "A" && !suited && num(b) >= 7) s += 1;
    if (!pair && suited && num(a) < 10) s -= 1;
  }
  if (stack <= 20) {
    if (pair) s += 1;
    if (!pair && a === "A") s += 1;
  }
  return Math.ceil(s) + (num(a) + num(b)) / 100 + (suited ? .005 : 0);
}

function isShove(h) {
  if (h.length === 2) return num(h[0]) <= 10;            // 22-TT
  return h[0] === "A" && h[2] === "o" && num(h[1]) <= 10; // A2o-ATo
}

// 컷오프 주변은 오픈 빈도가 1 → 0으로 부드럽게 줄어드는 혼합 구간으로 만든다
const BAND = 40; // 컷오프 앞뒤 콤보 수

const hands = allHands();
const spots = {};
for (const stack of STACKS) {
  spots[stack] = {};
  for (const pos of POSITIONS) {
    const byScore = (x, y) => score(y, stack) - score(x, stack);
    let order = [...hands].sort(byScore);
    if (stack >= 80) {
      const blog = [...BLOG_UTG].sort(byScore);
      order = [...blog, ...order.filter(h => !BLOG_UTG.includes(h))];
    }
    const target = pos === "UTG" && stack === 100
      ? BLOG_UTG.reduce((n, h) => n + combos(h), 0)
      : Math.round(1326 * BASE_PCT[pos] * STACK_MUL[stack] / 100);
    const shoveSpot = (stack <= 15 && ["HJ", "CO", "BTN", "SB"].includes(pos)) ||
                      (stack === 20 && ["BTN", "SB"].includes(pos));
    const spot = {};
    let n = 0;
    for (const h of order) {
      const mid = n + combos(h) / 2;
      n += combos(h);
      let freq = Math.min(1, Math.max(0, (target + BAND - mid) / (2 * BAND)));
      freq = Math.round(freq * 20) / 20;
      if (pos === "UTG" && stack === 100) {
        // 입문 블로그 2장 예시: 65s는 오픈, A8o는 폴드
        if (h === "65s") freq = 1;
        if (h === "A8o") freq = 0;
      }
      if (freq <= 0) continue;
      const act = shoveSpot && isShove(h) ? "A" : "R";
      spot[h] = freq >= 1 ? act : { [act]: freq };
    }
    spots[stack][pos] = spot;
  }
}

const data = {
  meta: {
    source: "approx",
    note: "solver/GTOWizard 결과가 아니다. 8-max, 앤티 없음 가정, SB는 레이즈/폴드로 단순화.",
  },
  stacks: STACKS,
  positions: POSITIONS,
  spots,
};

console.log("// 오픈 레인지 데이터. R=레이즈, A=올인, 없으면 폴드.\n" +
  "// 혼합 빈도는 {\"R\":0.6} 처럼 오픈 빈도만 쓰면 나머지는 폴드다.\n" +
  "window.RANGES = " + JSON.stringify(data, null, 1) + ";");
