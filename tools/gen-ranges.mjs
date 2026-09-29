// 학습용 근사 오픈 레인지 생성기 (solver 결과 아님)
// 실행: node tools/gen-ranges.mjs > train/ranges.js
// 실제 차트로 바꾸려면 오픈 훈련 페이지의 "차트 보기 → 편집"에서 칠한 뒤 내보내기 하면 된다.

const RANKS = "AKQJT98765432".split("");
const STACKS = [100, 80, 60, 50, 40, 30, 25, 20, 15];
const POSITIONS = ["UTG", "UTG+1", "LJ", "HJ", "CO", "BTN", "SB"];

// 100bb 기준 포지션별 오픈 비율(%)
const BASE_PCT = { "UTG": 17, "UTG+1": 20, "LJ": 24, "HJ": 29, "CO": 37, "BTN": 50, "SB": 42 };
const STACK_MUL = { 100: 1, 80: 1, 60: .98, 50: .97, 40: .95, 30: .93, 25: .92, 20: .92, 15: .95 };

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

// 프리플랍 오픈 가치 점수 (일반 원칙 기반 휴리스틱)
// - 페어: 셋을 맞추면 큰 팟을 이기고, 쇼다운 가치도 있어 높게 친다
// - 수딧: 플러쉬 가능성 + 연결성(스트레이트)이 플레이어빌리티를 만든다. A·K 수딧은 블락커와 넛 플러쉬 가치
// - 오프수딧: 도미네이트되기 쉽고 발전성이 낮아 크게 깎는다
const HV = { 14: 40, 13: 34, 12: 29, 11: 26, 10: 24, 9: 22, 8: 21, 7: 20, 6: 19, 5: 18, 4: 16, 3: 14, 2: 12 };
function score(h, stack) {
  const hi = num(h[0]), lo = num(h[1]), pair = h.length === 2, suited = h[2] === "s";
  const deep = stack >= 60, shallow = stack <= 30;
  if (pair) {
    let s = 38.5 + 2.5 * (hi - 2);        // 22=38.5, 44=43.5, 77=51, TT=58.5
    if (shallow) s += 2;                  // 짧을수록 셋 마이닝 대신 쇼다운 가치
    return s;
  }
  const gap = hi - lo - 1;
  let s;
  if (suited) {
    s = HV[hi] + 1.2 * lo;
    if (hi >= 13) s += 0;                 // A·K 수딧은 갭 페널티 없음
    else if (gap === 0) s += hi <= 10 ? 11 : 6;
    else if (gap === 1) s += hi <= 10 ? 6 : 7;
    else if (gap === 2) s += 0;
    else s -= 2 + (gap - 3);
    if (hi === 14 && lo <= 5 && lo >= 3) s += 2; // A5s~A3s: 휠 스트레이트
    if (hi === 14 && lo === 2) s -= 1.5;  // A2s: 휠은 되지만 키커가 가장 약하다
    // 낮은 수딧 커넥터·원갭은 카드 높이보다 연결성이 가치를 만든다
    if (hi <= 10 && hi >= 5 && gap === 0) s = Math.max(s, 37 + 0.6 * hi);
    if (hi <= 9 && hi >= 6 && gap === 1) s = Math.max(s, 34 + 0.5 * hi);
    if (hi <= 10 && gap <= 1) s += deep ? 1.5 : shallow ? -3 : 0; // 깊을수록 발전형 핸드 가치 상승
  } else {
    // 오프수딧: 키커가 약하면 도미네이트당하기 쉬워 키커 비중을 크게 둔다
    s = HV[hi] + 2 * lo - 17;
    if (gap === 0) s += 5; else if (gap === 1) s += 1.5;
    if (shallow && hi === 14) s += 3;     // 짧을수록 Ax 오프 가치 상승
  }
  return s + (suited ? .01 : 0) + lo / 1000;
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
    const order = [...hands].sort(byScore);
    const target = Math.round(1326 * BASE_PCT[pos] * STACK_MUL[stack] / 100);
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
