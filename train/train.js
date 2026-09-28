(function () {
  "use strict";

  var RANKS = "AKQJT98765432";
  var SEATS = ["UTG", "UTG+1", "LJ", "HJ", "CO", "BTN", "SB", "BB"];
  var NAMES = { F: "폴드", R: "레이즈", A: "올인" };
  var $ = function (id) { return document.getElementById(id); };

  // ---------- storage ----------
  function load(key, fallback) {
    try { var v = localStorage.getItem("ff." + key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem("ff." + key, JSON.stringify(val)); return true; } catch (e) { return false; }
  }
  function drop(key) {
    try { localStorage.removeItem("ff." + key); } catch (e) {}
  }

  // 불러온 ranges.js가 있으면 기본 데이터 대신 쓴다 (이 브라우저에만)
  function validRanges(d) {
    if (!d || !Array.isArray(d.stacks) || !Array.isArray(d.positions) || !d.spots) return false;
    return d.stacks.length > 0 && d.positions.length > 0 && d.stacks.every(function (s) {
      return d.spots[s] && d.positions.every(function (p) { return d.spots[s][p] && typeof d.spots[s][p] === "object"; });
    });
  }
  function parseRangesFile(text) {
    var m = /^\s*(\/\/.*\n\s*)*window\.RANGES\s*=/.exec(text);
    var body = m ? text.slice(m[0].length) : text;
    return JSON.parse(body.trim().replace(/;\s*$/, ""));
  }
  var imported = load("imported", null);
  var usingImport = validRanges(imported);
  var R = usingImport ? imported : window.RANGES;

  // ---------- hands & ranges ----------
  function handAt(i, j) {
    if (i === j) return RANKS[i] + RANKS[j];
    return i < j ? RANKS[i] + RANKS[j] + "s" : RANKS[j] + RANKS[i] + "o";
  }
  function combos(h) { return h.length === 2 ? 6 : h[2] === "s" ? 4 : 12; }
  var HANDS = [];
  for (var i = 0; i < 13; i++) for (var j = 0; j < 13; j++) HANDS.push(handAt(i, j));

  var overrides = load("overrides", {});
  function key(stack, pos) { return stack + "|" + pos; }
  function getSpot(stack, pos) {
    return overrides[key(stack, pos)] || R.spots[stack][pos];
  }
  // 핸드의 액션 빈도 {F,R,A}
  function freqs(spot, h) {
    var v = spot[h];
    if (!v) return { F: 1, R: 0, A: 0 };
    if (typeof v === "string") { var o = { F: 0, R: 0, A: 0 }; o[v] = 1; return o; }
    var f = { F: v.F || 0, R: v.R || 0, A: v.A || 0 };
    var sum = f.F + f.R + f.A;
    if (sum < 1) f.F += 1 - sum;
    return f;
  }
  function mainAction(f) {
    return f.R >= f.A && f.R >= f.F ? "R" : f.A >= f.F ? "A" : "F";
  }
  function openFreq(f) { return f.R + f.A; }

  function cellStyle(td, f) {
    var m = mainAction(f);
    td.className = m;
    td.style.background = "";
    var parts = ["R", "A", "F"].filter(function (a) { return f[a] > 0.001; });
    if (parts.length > 1) {
      var col = { R: "var(--raise-bg)", A: "var(--allin-bg)", F: "var(--fold-cell)" }, acc = 0, stops = [];
      parts.forEach(function (a) {
        stops.push(col[a] + " " + acc * 100 + "%");
        acc += f[a];
        stops.push(col[a] + " " + acc * 100 + "%");
      });
      td.style.background = "linear-gradient(90deg," + stops.join(",") + ")";
    }
  }

  // ---------- grid ----------
  function buildGrid(table, opts) {
    table.innerHTML = "";
    var cells = {};
    for (var i = 0; i < 13; i++) {
      var tr = document.createElement("tr");
      for (var j = 0; j < 13; j++) {
        var td = document.createElement("td"), h = handAt(i, j);
        td.textContent = h;
        td.dataset.h = h;
        cells[h] = td;
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    if (opts && opts.onPaint) enablePaint(table, opts);
    return cells;
  }

  // 누르고 드래그해서 칠하기 (마우스·터치 공용)
  function enablePaint(table, opts) {
    var painting = false, value = null, last = null;
    function cellFrom(e) {
      var el = document.elementFromPoint(e.clientX, e.clientY);
      return el && el.closest ? el.closest("td[data-h]") : null;
    }
    table.addEventListener("pointerdown", function (e) {
      if (!opts.enabled()) return;
      var td = cellFrom(e);
      if (!td) return;
      e.preventDefault();
      painting = true;
      value = opts.pickValue(td.dataset.h);
      last = td;
      opts.onPaint(td.dataset.h, value);
    });
    window.addEventListener("pointermove", function (e) {
      if (!painting) return;
      var td = cellFrom(e);
      if (td && td !== last && table.contains(td)) {
        last = td;
        opts.onPaint(td.dataset.h, value);
      }
    });
    window.addEventListener("pointerup", function () { painting = false; last = null; });
    window.addEventListener("pointercancel", function () { painting = false; last = null; });
  }

  function renderSpot(cells, spot, highlight) {
    HANDS.forEach(function (h) {
      cellStyle(cells[h], freqs(spot, h));
      if (h === highlight) cells[h].classList.add("hl");
    });
  }

  function summary(spot) {
    var r = 0, a = 0;
    HANDS.forEach(function (h) {
      var f = freqs(spot, h), c = combos(h);
      r += f.R * c; a += f.A * c;
    });
    return { R: r / 13.26, A: a / 13.26, total: (r + a) / 13.26 };
  }

  // ---------- chips ----------
  function chips(container, items, selected, multi, onChange, label) {
    container.innerHTML = "";
    items.forEach(function (it) {
      var b = document.createElement("button");
      b.className = "chip";
      b.textContent = label ? label(it) : it;
      b.setAttribute("aria-pressed", selected.indexOf(it) >= 0 ? "true" : "false");
      b.addEventListener("click", function () {
        var idx = selected.indexOf(it);
        if (multi) {
          if (idx >= 0) { if (selected.length > 1) selected.splice(idx, 1); }
          else selected.push(it);
        } else {
          selected.length = 0; selected.push(it);
        }
        Array.prototype.forEach.call(container.children, function (c, k) {
          c.setAttribute("aria-pressed", selected.indexOf(items[k]) >= 0 ? "true" : "false");
        });
        onChange();
      });
      container.appendChild(b);
    });
  }
  function bb(s) { return s + "bb"; }

  // ---------- notice ----------
  var notice = $("notice");
  if (usingImport) {
    notice.hidden = false;
    notice.innerHTML = "<b>불러온 레인지 사용 중</b> · 이 브라우저에만 적용된다. ";
    var back = document.createElement("button");
    back.className = "linkbtn";
    back.textContent = "기본 데이터로 되돌리기";
    back.addEventListener("click", function () {
      if (!confirm("불러온 레인지를 지우고 기본 데이터로 돌아갈까요?")) return;
      drop("imported");
      location.reload();
    });
    notice.appendChild(back);
  } else if (R.meta && R.meta.source === "approx") {
    notice.hidden = false;
    notice.innerHTML = "<b>학습용 근사 레인지</b> · " + R.meta.note +
      " 실제 solver 차트는 GTOWizard 등에서 직접 확인하고, <b>차트 보기 → 편집</b>으로 옮겨 적을 수 있다.";
  }

  // ---------- 불러오기 ----------
  document.querySelector('label[for="c-import-file"]').addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("c-import-file").click(); }
  });
  $("c-import-file").addEventListener("change", function () {
    var file = this.files && this.files[0];
    this.value = "";
    if (!file) return;
    file.text().then(function (text) {
      var data;
      try { data = parseRangesFile(text); } catch (e) { data = null; }
      if (!validRanges(data)) {
        alert("ranges.js 형식이 아니에요. 이 페이지에서 내보낸 파일을 선택해 주세요.");
        return;
      }
      var hasEdits = Object.keys(overrides).length > 0;
      if (hasEdits && !confirm("불러오면 지금 편집한 내용은 지워져요. 계속할까요?")) return;
      if (!save("imported", data)) { alert("브라우저 저장소에 저장하지 못했어요."); return; }
      drop("overrides");
      location.reload();
    });
  });

  // ---------- mode tabs ----------
  var modeBtns = document.querySelectorAll(".modes button");
  function setMode(m) {
    Array.prototype.forEach.call(modeBtns, function (b) {
      b.setAttribute("aria-selected", b.dataset.mode === m ? "true" : "false");
    });
    ["quiz", "chart", "paint"].forEach(function (x) { $("p-" + x).hidden = x !== m; });
    save("mode", m);
    if (m === "chart") drawChart();
    if (m === "paint") newPaint(false);
  }
  Array.prototype.forEach.call(modeBtns, function (b) {
    b.addEventListener("click", function () { setMode(b.dataset.mode); });
  });

  // =========================================================
  // QUIZ
  // =========================================================
  var qf = load("quizFilter", { stacks: R.stacks.slice(0, 1), pos: R.positions.slice(), border: true });
  qf.stacks = qf.stacks.filter(function (s) { return R.stacks.indexOf(s) >= 0; });
  qf.pos = qf.pos.filter(function (p) { return R.positions.indexOf(p) >= 0; });
  if (!qf.stacks.length) qf.stacks = [R.stacks[0]];
  if (!qf.pos.length) qf.pos = R.positions.slice();
  var st = load("quizStats", { n: 0, ok: 0, streak: 0, best: 0, misses: [] });
  var cur = null, answered = false;
  var qCells = buildGrid($("q-grid"));

  function saveFilter() { save("quizFilter", qf); }
  chips($("q-stacks"), R.stacks, qf.stacks, true, function () { saveFilter(); newQuestion(); }, bb);
  chips($("q-pos"), R.positions, qf.pos, true, function () { saveFilter(); newQuestion(); });
  $("q-border").setAttribute("aria-pressed", qf.border ? "true" : "false");
  $("q-border").addEventListener("click", function () {
    qf.border = !qf.border;
    this.setAttribute("aria-pressed", qf.border ? "true" : "false");
    saveFilter();
  });

  // 경계 핸드: 같은 하이카드 안에서 키커가 한 단계 내려갈 때 액션이 바뀌는 지점의 양쪽
  // (예: K9s 오픈 / K8s 폴드), 페어는 한 단계 낮은 페어와 비교, 혼합 빈도 핸드는 항상 경계
  function borderHands(spot) {
    var set = {};
    function scan(seq) {
      for (var k = 0; k + 1 < seq.length; k++) {
        if (mainAction(freqs(spot, seq[k])) !== mainAction(freqs(spot, seq[k + 1]))) {
          set[seq[k]] = set[seq[k + 1]] = true;
        }
      }
    }
    var pairs = [];
    for (var i = 0; i < 13; i++) {
      var suited = [], offsuit = [];
      for (var j = i + 1; j < 13; j++) { suited.push(handAt(i, j)); offsuit.push(handAt(j, i)); }
      scan(suited); scan(offsuit);
      pairs.push(handAt(i, i));
    }
    scan(pairs);
    HANDS.forEach(function (h) {
      var f = freqs(spot, h);
      if (Math.max(f.F, f.R, f.A) < 0.999) set[h] = true;
    });
    return Object.keys(set);
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function pickByCombos(list) {
    var total = list.reduce(function (n, h) { return n + combos(h); }, 0), r = Math.random() * total;
    for (var k = 0; k < list.length; k++) { r -= combos(list[k]); if (r <= 0) return list[k]; }
    return list[list.length - 1];
  }

  function pickHand(spot) {
    if (qf.border && Math.random() < 0.85) {
      var b = borderHands(spot);
      if (b.length) return pick(b);
    }
    return pickByCombos(HANDS);
  }

  function dealSuits(h) {
    var suits = ["s", "h", "d", "c"];
    var s1 = pick(suits), s2;
    if (h[2] === "s") s2 = s1;
    else { do { s2 = pick(suits); } while (s2 === s1); }
    return [[h[0], s1], [h[1], s2]];
  }
  var SUIT = { s: "♠", h: "♥", d: "♦", c: "♣" };

  function newQuestion(fixed) {
    var stack = fixed ? fixed.stack : pick(qf.stacks);
    var pos = fixed ? fixed.pos : pick(qf.pos);
    var spot = getSpot(stack, pos);
    var h = fixed ? fixed.h : pickHand(spot);
    cur = { stack: stack, pos: pos, h: h, f: freqs(spot, h) };
    answered = false;

    $("q-stk").textContent = stack + "bb";
    $("q-posname").textContent = pos;
    var seats = $("q-seats"); seats.innerHTML = "";
    var me = SEATS.indexOf(pos);
    SEATS.forEach(function (s, k) {
      var d = document.createElement("div");
      d.className = "seat" + (k < me ? " folded" : k === me ? " me" : "");
      d.textContent = s;
      seats.appendChild(d);
    });
    var cards = $("q-cards"); cards.innerHTML = "";
    dealSuits(h).forEach(function (c) {
      var d = document.createElement("div");
      d.className = "pc " + (c[1] === "h" || c[1] === "d" ? "red" : "blk");
      d.innerHTML = '<span class="r">' + (c[0] === "T" ? "10" : c[0]) + '</span><span class="s">' + SUIT[c[1]] + "</span>";
      cards.appendChild(d);
    });
    var allinOk = stack <= 25 || cur.f.A > 0;
    document.querySelectorAll("#q-acts .act").forEach(function (b) {
      b.disabled = false;
      b.classList.remove("picked");
      if (b.dataset.a === "A") b.hidden = !allinOk;
    });
    $("q-fb").className = "fb";
    $("q-next").className = "next";
    $("q-chartwrap").hidden = true;
  }

  function pct(x) { return Math.round(x * 100) + "%"; }

  function answer(a) {
    if (answered || !cur) return;
    var btn = document.querySelector('#q-acts .act[data-a="' + a + '"]');
    if (!btn || btn.hidden) return;
    answered = true;
    var f = cur.f, best = mainAction(f);
    var ok = f[a] >= 0.3 || a === best;
    st.n++;
    if (ok) { st.ok++; st.streak++; st.best = Math.max(st.best, st.streak); }
    else {
      st.streak = 0;
      st.misses = [{ stack: cur.stack, pos: cur.pos, h: cur.h }].concat(
        st.misses.filter(function (m) { return !(m.h === cur.h && m.stack === cur.stack && m.pos === cur.pos); })
      ).slice(0, 12);
    }
    save("quizStats", st);

    document.querySelectorAll("#q-acts .act").forEach(function (b) { b.disabled = true; });
    btn.classList.add("picked");
    btn.disabled = false;

    var mixed = ["R", "A", "F"].filter(function (x) { return f[x] > 0.001; });
    var ans = mixed.length > 1
      ? mixed.map(function (x) { return NAMES[x] + " " + pct(f[x]); }).join(" · ")
      : NAMES[best];
    var fb = $("q-fb");
    fb.className = "fb show " + (ok ? "good" : "bad");
    fb.innerHTML = (ok ? "<b>정답</b> · " : "<b>오답</b> · ") + cur.pos + " " + cur.stack + "bb에서 " +
      "<span style='font-family:var(--mono)'>" + cur.h + "</span>는 <b>" + ans + "</b>";
    $("q-next").className = "next show";

    $("q-chartwrap").hidden = false;
    $("q-chartcap").textContent = cur.stack + "bb · " + cur.pos + " 오픈 레인지 (" + summary(getSpot(cur.stack, cur.pos)).total.toFixed(1) + "%)";
    renderSpot(qCells, getSpot(cur.stack, cur.pos), cur.h);
    drawStats();
  }

  function drawStats() {
    $("s-acc").textContent = st.n ? Math.round(st.ok / st.n * 100) + "%" : "-";
    $("s-streak").textContent = st.streak;
    $("s-best").textContent = st.best;
    var box = $("q-misses"); box.innerHTML = "";
    if (!st.misses.length) { box.innerHTML = '<span class="empty">아직 없음</span>'; return; }
    st.misses.forEach(function (m) {
      var b = document.createElement("button");
      b.className = "miss";
      b.title = "다시 풀기";
      b.textContent = m.h + " · " + m.pos + " " + m.stack + "bb";
      b.addEventListener("click", function () { setMode("quiz"); newQuestion(m); });
      box.appendChild(b);
    });
  }

  document.querySelectorAll("#q-acts .act").forEach(function (b) {
    b.addEventListener("click", function () { answer(b.dataset.a); });
  });
  $("q-next").addEventListener("click", function () { newQuestion(); });
  $("q-reset").addEventListener("click", function () {
    if (!confirm("퀴즈 기록을 초기화할까요?")) return;
    st = { n: 0, ok: 0, streak: 0, best: 0, misses: [] };
    save("quizStats", st); drawStats();
  });
  document.addEventListener("keydown", function (e) {
    if ($("p-quiz").hidden || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest("input,textarea")) return;
    var k = e.key.toLowerCase();
    if (!answered && (k === "f" || k === "r" || k === "a")) { e.preventDefault(); answer(k.toUpperCase()); }
    else if (answered && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); newQuestion(); }
  });

  // =========================================================
  // CHART (보기 + 편집)
  // =========================================================
  var cs = load("chartSel", { stack: R.stacks[0], pos: R.positions[0] });
  if (R.stacks.indexOf(cs.stack) < 0) cs.stack = R.stacks[0];
  if (R.positions.indexOf(cs.pos) < 0) cs.pos = R.positions[0];
  var cStack = [cs.stack], cPos = [cs.pos], editing = false, brush = "R";

  function chartChanged() { cs = { stack: cStack[0], pos: cPos[0] }; save("chartSel", cs); drawChart(); }
  chips($("c-stacks"), R.stacks, cStack, false, chartChanged, bb);
  chips($("c-pos"), R.positions, cPos, false, chartChanged);

  var cCells = buildGrid($("c-grid"), {
    enabled: function () { return editing; },
    pickValue: function (h) {
      var cur = mainAction(freqs(getSpot(cs.stack, cs.pos), h));
      return cur === brush && brush !== "F" ? "F" : brush;
    },
    onPaint: function (h, v) {
      var k = key(cs.stack, cs.pos);
      if (!overrides[k]) overrides[k] = JSON.parse(JSON.stringify(R.spots[cs.stack][cs.pos]));
      if (v === "F") delete overrides[k][h]; else overrides[k][h] = v;
      save("overrides", overrides);
      drawChart();
    }
  });

  function drawChart() {
    var spot = getSpot(cs.stack, cs.pos), s = summary(spot);
    renderSpot(cCells, spot);
    HANDS.forEach(function (h) { cCells[h].classList.toggle("clickable", editing); });
    $("c-cap").innerHTML = cs.stack + "bb · " + cs.pos + " 오픈 레인지" +
      (overrides[key(cs.stack, cs.pos)] ? '<span class="edited">수정됨</span>' : "");
    $("c-sum").innerHTML = "레이즈 <b>" + s.R.toFixed(1) + "%</b>" +
      (s.A > 0 ? " · 올인 <b>" + s.A.toFixed(1) + "%</b>" : "") +
      " · 전체 오픈 <b>" + s.total.toFixed(1) + "%</b>";
  }

  $("c-edit").addEventListener("click", function () {
    editing = !editing;
    this.setAttribute("aria-pressed", editing ? "true" : "false");
    this.textContent = editing ? "편집 끝내기" : "편집";
    $("c-brushes").hidden = !editing;
    drawChart();
  });
  document.querySelectorAll("#c-brushes .chip").forEach(function (b) {
    b.addEventListener("click", function () {
      brush = b.dataset.brush;
      document.querySelectorAll("#c-brushes .chip").forEach(function (x) {
        x.setAttribute("aria-pressed", x === b ? "true" : "false");
      });
    });
  });
  $("c-revert").addEventListener("click", function () {
    var k = key(cs.stack, cs.pos);
    if (!overrides[k]) return;
    if (!confirm(cs.stack + "bb " + cs.pos + " 차트의 수정 내용을 지울까요?")) return;
    delete overrides[k];
    save("overrides", overrides);
    drawChart();
  });
  $("c-export").addEventListener("click", function () {
    var out = JSON.parse(JSON.stringify(R));
    var edited = Object.keys(overrides);
    edited.forEach(function (k) {
      var p = k.split("|");
      out.spots[p[0]][p[1]] = overrides[k];
    });
    if (edited.length) out.meta = { source: "custom", note: "직접 입력한 차트." };
    var text = "// 오픈 레인지 데이터. R=레이즈, A=올인, 없으면 폴드.\n" +
      "// 혼합 빈도는 {\"R\":0.6,\"F\":0.4} 처럼 쓸 수 있다.\n" +
      "window.RANGES = " + JSON.stringify(out, null, 1) + ";\n";
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/javascript" }));
    a.download = "ranges.js";
    document.body.appendChild(a); a.click(); a.remove();
  });

  // =========================================================
  // PAINT TEST
  // =========================================================
  var ts = load("paintSel", { stack: R.stacks[0], pos: R.positions[0] });
  if (R.stacks.indexOf(ts.stack) < 0) ts.stack = R.stacks[0];
  if (R.positions.indexOf(ts.pos) < 0) ts.pos = R.positions[0];
  var tStack = [ts.stack], tPos = [ts.pos], painted = {}, graded = false;
  var bestScores = load("paintBest", {});

  function paintChanged() { ts = { stack: tStack[0], pos: tPos[0] }; save("paintSel", ts); newPaint(false); }
  function drawPaintChips() {
    chips($("t-stacks"), R.stacks, tStack, false, paintChanged, bb);
    chips($("t-pos"), R.positions, tPos, false, paintChanged);
  }
  drawPaintChips();

  var tCells = buildGrid($("t-grid"), {
    enabled: function () { return !graded; },
    pickValue: function (h) { return !painted[h]; },
    onPaint: function (h, v) {
      if (v) painted[h] = true; else delete painted[h];
      tCells[h].className = "clickable " + (painted[h] ? "R" : "F");
    }
  });

  function newPaint(random) {
    if (random) {
      tStack[0] = pick(R.stacks); tPos[0] = pick(R.positions);
      ts = { stack: tStack[0], pos: tPos[0] }; save("paintSel", ts);
      drawPaintChips();
    }
    painted = {}; graded = false;
    HANDS.forEach(function (h) { tCells[h].className = "clickable F"; tCells[h].style.background = ""; });
    $("t-cap").textContent = ts.stack + "bb · " + ts.pos + " 에서 오픈하는 핸드를 칠하자";
    $("t-result").hidden = true;
    $("t-legend").hidden = false;
    var b = bestScores[key(ts.stack, ts.pos)];
    $("t-best").textContent = b != null ? b + "%" : "-";
  }

  $("t-random").addEventListener("click", function () { newPaint(true); });
  $("t-clear").addEventListener("click", function () { newPaint(false); });
  $("t-grade").addEventListener("click", function () {
    if (graded) return;
    graded = true;
    var spot = getSpot(ts.stack, ts.pos), hit = 0, miss = 0, extra = 0, nMiss = 0, nExtra = 0;
    HANDS.forEach(function (h) {
      var should = openFreq(freqs(spot, h)) >= 0.5, did = !!painted[h], c = combos(h), td = tCells[h];
      td.style.background = "";
      if (should && did) { hit += c; td.className = "g-ok"; }
      else if (should) { miss += c; nMiss++; td.className = "g-miss"; }
      else if (did) { extra += c; nExtra++; td.className = "g-extra"; }
      else td.className = "F";
    });
    var denom = hit + miss + extra, score = denom ? Math.round(hit / denom * 100) : 100;
    $("t-result").hidden = false;
    $("t-legend").hidden = true;
    $("t-score").textContent = score + "%";
    $("t-detail").textContent = "놓친 핸드 " + nMiss + "개 · 잘못 칠한 핸드 " + nExtra + "개 (콤보 가중 일치율)";
    var k = key(ts.stack, ts.pos);
    if (bestScores[k] == null || score > bestScores[k]) { bestScores[k] = score; save("paintBest", bestScores); }
    $("t-best").textContent = bestScores[k] + "%";
  });

  // ---------- init ----------
  drawStats();
  newQuestion();
  setMode(load("mode", "quiz"));
})();
