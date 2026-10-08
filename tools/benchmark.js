// 익스 연습장 기준선 계산기
// 각 봇 × 스택마다 두 전략의 bb/100을 시뮬레이션으로 잰다.
//   정석: 상대가 누구든 똑같이 치는 탄탄한 플레이 (팟오즈대로 콜, 블러프 없음)
//   클로드: 상대 버릇에 맞춘 익스 (후보 중 가장 좋은 것을 고르고, 새 핸드로 다시 잰다)
// 실행: node tools/benchmark.js > exploit/benchmarks.js
"use strict";
const E = require("../exploit/engine.js");
const B = require("../exploit/bots.js");

const STACKS = [10, 15, 20, 30, 50, 100];
const SEARCH_HANDS = +process.env.SEARCH || 40000;   // 후보 고르기
const FINAL_HANDS = +process.env.FINAL || 150000;    // 고른 전략을 새 핸드로 다시 재기

function view(h, p) {
  const o = 1 - p;
  return { me: p, hole: h.hole[p], board: h.board, street: h.street, isButton: h.button === p, toCall: h.toCall(p),
    pot: h.potTotal(), myStack: h.stacks[p], oppStack: h.stacks[o], myBet: h.bets[p], oppBet: h.bets[o],
    legal: h.legal(p), log: h.log, bb: h.bb };
}
function raiseTo(v, to) {
  const L = v.legal.raise;
  if (!L) return v.legal.call ? { type: "call" } : { type: "check" };
  to = Math.max(L.min, Math.min(L.max, to));
  if (to >= L.max * 0.7) to = L.max;
  return { type: "raise", to: Math.round(to * 2) / 2 };
}

// ---------- 내 쪽 전략 ----------
const PRE_BASE = { jitter: 3, open: { raise: 70 }, openSize: 2.5, vsLimp: { raise: 40 }, isoSize: 4,
  vsRaise: { threeBet: 12, call: 45 }, threeBetSize: 3, vs3bet: { shove: 4, call: 35 }, vsShove: { call: 12 } };

// 프리플랍은 띠(band) 프로필, 플랍 이후는 승률 어림 + 팟오즈
function solid(pre, opt) {
  opt = opt || {};
  return { think(v) {
    if (v.street === 0) return B.decide({ pre: pre, post: {} }, v);
    const f = B.postFeel(v), eq = B.equityGuess(f, v.street), pot = v.pot - v.toCall;
    const size = opt.size || 0.66;
    if (v.toCall === 0) {
      if (!v.legal.raise) return { type: "check" };
      if (f.score >= 4) return raiseTo(v, pot * size);
      if (/드로우|거트샷/.test(f.label) && v.street < 3 && Math.random() < 0.5) return raiseTo(v, pot * size);
      if (eq < 0.2 && Math.random() < (opt.bluff || 0)) return raiseTo(v, pot * size);
      return { type: "check" };
    }
    const req = v.toCall / (v.pot + v.toCall);
    if (v.legal.raise && f.score >= 5) return raiseTo(v, v.oppBet * 3);
    return eq + (opt.wide || 0) >= req ? { type: "call" } : { type: "fold" };
  } };
}

// 올리 전용: 버튼에서 미니레이즈(또는 올인), 올리가 밀면 상위 몇 %로 콜
function vsOllie(raisePct, callAfterRaise, callAsBB, mode) {
  return { think(v) {
    const pct = B.PCT[E.handClass(v.hole[0], v.hole[1])];
    if (v.street > 0) return v.legal.check ? { type: "check" } : { type: "call" };
    const facingShove = v.toCall > 0 && (v.oppStack === 0 || v.toCall >= v.myStack * 0.6);
    if (facingShove) {
      const iRaised = v.log.some(e => e.street === 0 && e.p === v.me && e.type === "raise");
      return pct < (iRaised ? callAfterRaise : callAsBB) ? { type: "call" } : { type: "fold" };
    }
    if (v.isButton && v.log.filter(e => e.street === 0).length === 0) {
      if (pct >= raisePct) return { type: "fold" };
      return mode === "shove" ? raiseTo(v, 999) : raiseTo(v, 2);
    }
    return v.legal.check ? { type: "check" } : { type: "fold" };
  } };
}

function candidates(botId) {
  if (botId === "ollie") {
    const list = [];
    for (const c1 of [15, 25, 35]) for (const c2 of [20, 30, 40]) list.push([`미니레이즈 100% · 리레이즈 올인에 ${c1}% · BB ${c2}% 콜`, vsOllie(100, c1, c2, "min")]);
    for (const s of [30, 45]) for (const c2 of [20, 30, 40]) list.push([`버튼 ${s}% 올인 · BB ${c2}% 콜`, vsOllie(s, 0, c2, "shove")]);
    return list;
  }
  const steal = Object.assign({}, PRE_BASE, { open: { raise: 100 }, openSize: 2, vsLimp: { raise: 60 }, isoSize: 3 });
  const isoBig = Object.assign({}, PRE_BASE, { vsLimp: { raise: 60 }, isoSize: 4 });
  if (botId === "penny") return [
    ["블러프 80% · 2/3 팟", solid(PRE_BASE, { bluff: 0.8, size: 0.66 })],
    ["블러프 80% · 2/3 팟 · 림프에 크게 레이즈", solid(isoBig, { bluff: 0.8, size: 0.66 })],
    ["블러프 100% · 2/3 팟", solid(PRE_BASE, { bluff: 1, size: 0.66 })],
    ["블러프 60% · 팟", solid(PRE_BASE, { bluff: 0.6, size: 1 })]
  ];
  if (botId === "aggie") return [
    ["팟오즈 정석", solid(PRE_BASE, {})],
    ["팟오즈 · 조금 넓게 콜", solid(PRE_BASE, { wide: 0.05 })],
    ["팟오즈 · 조금 좁게 콜", solid(PRE_BASE, { wide: -0.05 })]
  ];
  if (botId === "nicky") return [
    ["스틸 + 팟오즈", solid(steal, {})],
    ["스틸 + 니키 레이즈엔 좁게", solid(Object.assign({}, steal, { vsRaise: { threeBet: 5, call: 18 }, vs3bet: { shove: 3, call: 6 }, vsShove: { call: 8 } }), {})],
    ["스틸 + 블러프 20%", solid(steal, { bluff: 0.2 })]
  ];
  return [];
}

function run(bot, hero, stack, n) {
  let net = 0, sq = 0;
  for (let i = 0; i < n; i++) {
    const h = new E.Hand({ stack: stack, button: i % 2 });
    while (!h.done) { const p = h.toAct; h.act(p, B.decide(p === 1 ? bot : hero, view(h, p))); }
    net += h.net; sq += h.net * h.net;
  }
  const m = net / n, se = Math.sqrt(sq / n - m * m) / Math.sqrt(n);
  return { bb100: +(m * 100).toFixed(1), ci: +(se * 196).toFixed(1) };
}

// ONLY=nicky 처럼 일부 봇만 다시 계산하면, 나머지는 기존 exploit/benchmarks.js 값을 그대로 쓴다
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const out = {};
if (ONLY) {
  try {
    const prev = require("fs").readFileSync(require("path").join(__dirname, "../exploit/benchmarks.js"), "utf8");
    Object.assign(out, JSON.parse(prev.slice(prev.indexOf("{"), prev.lastIndexOf("}") + 1)));
  } catch (e) { /* 기존 파일이 없으면 새로 만든다 */ }
}
for (const bot of B.BOTS.filter(b => b.available && (!ONLY || ONLY.indexOf(b.id) >= 0))) {
  out[bot.id] = {};
  for (const stack of STACKS) {
    const base = run(bot, solid(PRE_BASE, {}), stack, FINAL_HANDS);
    let best = null;
    for (const [name, hero] of candidates(bot.id)) {
      const r = run(bot, hero, stack, SEARCH_HANDS);
      if (!best || r.bb100 > best.r.bb100) best = { name, hero, r };
    }
    // 정석과 똑같은 전략이 뽑히면 같은 수치를 두 번 재지 않는다 (재면 오차 때문에 숫자만 달라진다)
    const fin = best.name === "팟오즈 정석" ? base : run(bot, best.hero, stack, FINAL_HANDS);
    // 맞춤 익스가 정석보다 못하면 정석을 클로드 기준선으로 쓴다
    const claude = fin.bb100 >= base.bb100 ? { bb100: fin.bb100, ci: fin.ci, how: best.name } : { bb100: base.bb100, ci: base.ci, how: "정석과 같음" };
    out[bot.id][stack] = { solid: base, claude };
    console.error(`${bot.name} ${stack}bb · 정석 ${base.bb100}±${base.ci} · 클로드 ${claude.bb100}±${claude.ci} (${claude.how})`);
  }
}
console.log("// 익스 연습장 기준선 (tools/benchmark.js로 계산, 단위 bb/100, ci는 95% 오차 범위)\n" +
  "window.BENCHMARKS = " + JSON.stringify(out, null, 1) + ";");
