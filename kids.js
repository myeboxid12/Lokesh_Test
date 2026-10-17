// Games (picture puzzle, memory, word search, numbers) and the Travel blog.
// Uses `sections` and `esc` from the main script in index.html.
(() => {
  const $ = id => document.getElementById(id);
  const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  const store = {
    get(k, d) { try { const v = localStorage.getItem("kids:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("kids:" + k, JSON.stringify(v)); return true; } catch { return false; } }
  };
  // Characters with pictures, for the puzzle and memory game
  const people = sections.flatMap(s => ["good", "bad"].flatMap(k => (s[k] || []).map(([name, img]) => ({ name, img: `images/${img}.png`, show: s.title }))));

  /* ================= Views & sidebar ================= */
  const views = { characters: $("view-characters"), games: $("view-games"), travel: $("view-travel") };
  let stopGame = () => {};
  function showView(v) {
    for (const [k, el] of Object.entries(views)) el.hidden = k !== v;
    document.querySelectorAll("aside a.field").forEach(a => a.classList.toggle("on", a.dataset.view === v));
  }
  window.showView = showView;
  function route() {
    stopGame(); stopGame = () => {};
    const h = decodeURIComponent(location.hash.slice(1));
    const [top, sub] = h.split("/");
    document.querySelectorAll("aside .field-links a").forEach(a => a.classList.toggle("on", top === "games" && a.dataset.game === sub));
    if (top === "games") { showView("games"); (GAMES[sub]?.run || gameHub)(views.games); }
    else if (top === "travel") { showView("travel"); travel(views.travel); }
    else { showView("characters"); if (top === "characters") scrollTo(0, 0); return; }
    scrollTo(0, 0);
  }
  addEventListener("hashchange", route);
  document.querySelector("aside").addEventListener("click", e => {
    if (e.target.closest("a.field, .field-links a")) { document.body.classList.remove("menu-open"); $("menu-btn")?.setAttribute("aria-expanded", "false"); }
  });

  const header = (title, sub) => `<a class="back-link" href="#games">← All games</a><h1>${title}</h1><p class="sub">${sub}</p>`;
  const seg = (name, opts, cur) => `<div class="seg-k" role="group" aria-label="${name}">${opts.map(([v, t]) => `<button type="button" data-${name}="${v}" aria-pressed="${v === cur}">${t}</button>`).join("")}</div>`;
  const timeText = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  /* ================= Game hub ================= */
  const GAMES = {
    puzzle: { emoji: "🧩", name: "Picture puzzle", about: "Slide the tiles to rebuild a character picture.", run: puzzle },
    memory: { emoji: "🃏", name: "Memory game", about: "Flip cards and find the matching characters.", run: memory },
    wordsearch: { emoji: "🔤", name: "Word search", about: "Find hidden words in the letter grid.", run: wordSearch },
    numbers: { emoji: "➕", name: "Numbers", about: "Practise adding, taking away and times tables.", run: numbers }
  };
  function gameHub(el) {
    el.innerHTML = `<h1>Games</h1><p class="sub">Puzzles, memory, words and numbers. Pick a game to play!</p>
      <div class="game-hub">${Object.entries(GAMES).map(([k, g]) => `<a class="game-card" href="#games/${k}"><span class="em">${g.emoji}</span><b>${g.name}</b><span>${g.about}</span></a>`).join("")}</div>`;
  }

  /* ================= Picture puzzle (sliding tiles) ================= */
  function puzzle(el) {
    let n = store.get("puzzle-size", 3), nums = store.get("puzzle-nums", true), pic, order, moves, secs, timer, img;
    el.innerHTML = header("🧩 Picture puzzle", "Slide the tiles next to the empty space until the picture is complete.") + `
      <div class="krow">${seg("size", [[3, "3 × 3 · Easy"], [4, "4 × 4 · Medium"], [5, "5 × 5 · Hard"]], n)}
        <button class="kbtn alt sm" id="pz-new">New picture</button><button class="kbtn alt sm" id="pz-shuffle">Shuffle again</button>
        <label class="krow" style="gap:6px;font-size:.9rem"><input type="checkbox" id="pz-nums" ${nums ? "checked" : ""}> Show numbers</label></div>
      <div class="puzzle-wrap"><div class="puzzle" id="pz" aria-label="Sliding puzzle"></div>
        <div class="kpanel"><b id="pz-name"></b><p class="kstat" style="margin:6px 0 12px"><span>Moves <b id="pz-moves">0</b></span><span>Time <b id="pz-time">0:00</b></span><span>Best <b id="pz-best">–</b></span></p>
          <div class="peek" id="pz-peek" role="img" aria-label="The finished picture"></div><p class="sub" style="margin:10px 0 0;font-size:.85rem">Tip: you can also use the arrow keys.</p></div></div>
      <div id="pz-win"></div>`;
    const grid = $("pz");
    const build = src => new Promise(res => {
      const im = new Image(); im.onload = () => {
        const S = 600, cv = document.createElement("canvas"); cv.width = cv.height = S; const g = cv.getContext("2d");
        g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--img-bg").trim() || "#f1eee7"; g.fillRect(0, 0, S, S);
        const k = Math.min(S * .9 / im.width, S * .9 / im.height), w = im.width * k, h = im.height * k;
        g.drawImage(im, (S - w) / 2, (S - h) / 2, w, h); res(cv.toDataURL("image/png"));
      }; im.onerror = () => res(src); im.src = src;
    });
    const blank = () => order.indexOf(n * n - 1);
    const neighbours = p => [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([dr, dc]) => [Math.floor(p / n) + dr, p % n + dc]).filter(([r, c]) => r >= 0 && c >= 0 && r < n && c < n).map(([r, c]) => r * n + c);
    function shuffleTiles() {
      order = [...Array(n * n).keys()]; let prev = -1;
      for (let i = 0; i < n * n * 30; i++) { const b = blank(), opts = neighbours(b).filter(p => p !== prev), p = opts[rand(0, opts.length - 1)]; [order[b], order[p]] = [order[p], order[b]]; prev = b; }
      if (order.every((t, i) => t === i)) return shuffleTiles();
      moves = 0; secs = 0; clearInterval(timer); timer = null; $("pz-win").innerHTML = ""; draw();
    }
    function draw() {
      grid.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`; grid.classList.toggle("no-nums", !nums);
      grid.innerHTML = order.map((t, p) => t === n * n - 1 ? `<div class="tile blank" aria-hidden="true"></div>`
        : `<button class="tile" data-p="${p}" aria-label="Tile ${t + 1}" style="background-image:url(${img});background-size:${n * 100}% ${n * 100}%;background-position:${(t % n) / (n - 1) * 100}% ${Math.floor(t / n) / (n - 1) * 100}%"><span class="num">${t + 1}</span></button>`).join("");
      $("pz-moves").textContent = moves; $("pz-time").textContent = timeText(secs);
      const best = store.get(`puzzle-best-${n}`, null); $("pz-best").textContent = best ? `${best} moves` : "–";
    }
    function move(p) {
      const b = blank(); if (!neighbours(b).includes(p) || $("pz-win").innerHTML) return;
      [order[b], order[p]] = [order[p], order[b]]; moves++;
      if (!timer) timer = setInterval(() => { secs++; $("pz-time") && ($("pz-time").textContent = timeText(secs)); }, 1000);
      draw();
      if (order.every((t, i) => t === i)) {
        clearInterval(timer);
        const best = store.get(`puzzle-best-${n}`, null), record = !best || moves < best; if (record) store.set(`puzzle-best-${n}`, moves);
        grid.innerHTML = `<div style="grid-column:1/-1;grid-row:1/-1;border-radius:10px;background:url(${img}) center/cover"></div>`;
        $("pz-win").innerHTML = `<div class="win"><span><span class="big">🎉</span> You solved it in ${moves} moves and ${timeText(secs)}!${record ? " New best!" : ""}</span><button class="kbtn" id="pz-again">Play again</button></div>`;
        $("pz-again").onclick = () => newPicture();
      }
    }
    async function newPicture() {
      pic = people[rand(0, people.length - 1)];
      $("pz-name").textContent = `${pic.name} · ${pic.show}`;
      img = await build(pic.img); $("pz-peek").style.backgroundImage = `url(${img})`; shuffleTiles();
    }
    grid.addEventListener("click", e => { const t = e.target.closest("[data-p]"); if (t) move(+t.dataset.p); });
    const key = e => {
      const map = { ArrowUp: [1, 0], ArrowDown: [-1, 0], ArrowLeft: [0, 1], ArrowRight: [0, -1] }[e.key]; if (!map || !order) return;
      const b = blank(), r = Math.floor(b / n) + map[0], c = b % n + map[1];
      if (r >= 0 && c >= 0 && r < n && c < n) { e.preventDefault(); move(r * n + c); }
    };
    addEventListener("keydown", key);
    stopGame = () => { clearInterval(timer); removeEventListener("keydown", key); };
    el.querySelector(".seg-k").addEventListener("click", e => { const b = e.target.closest("[data-size]"); if (!b) return; n = +b.dataset.size; store.set("puzzle-size", n); el.querySelectorAll("[data-size]").forEach(x => x.setAttribute("aria-pressed", x === b)); shuffleTiles(); });
    $("pz-new").onclick = newPicture; $("pz-shuffle").onclick = shuffleTiles;
    $("pz-nums").onchange = e => { nums = e.target.checked; store.set("puzzle-nums", nums); draw(); };
    newPicture();
  }

  /* ================= Memory game ================= */
  function memory(el) {
    let pairs = store.get("memory-pairs", 6), timer;
    el.innerHTML = header("🃏 Memory game", "Turn over two cards at a time. Find every matching pair of characters!") + `
      <div class="krow">${seg("pairs", [[6, "Easy · 6 pairs"], [8, "Medium · 8 pairs"], [10, "Hard · 10 pairs"]], pairs)}<button class="kbtn alt sm" id="mm-new">New game</button></div>
      <p class="kstat" style="margin:12px 0 0"><span>Moves <b id="mm-moves">0</b></span><span>Pairs found <b id="mm-found">0</b></span><span>Time <b id="mm-time">0:00</b></span><span>Best <b id="mm-best">–</b></span></p>
      <div class="mem" id="mm"></div><div id="mm-win"></div>`;
    function start() {
      clearInterval(timer); timer = null;
      const picks = shuffle(people).filter((p, i, a) => a.findIndex(q => q.img === p.img) === i).slice(0, pairs);
      const cards = shuffle(picks.flatMap((p, i) => [{ ...p, pair: i }, { ...p, pair: i }]));
      let up = [], found = 0, moves = 0, secs = 0, lock = false;
      const cols = pairs === 6 ? 4 : pairs === 8 ? 4 : 5;
      const grid = $("mm"); grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
      grid.innerHTML = cards.map((c, i) => `<button class="mcard" data-i="${i}" aria-label="Card ${i + 1}, face down"><span class="mcard-in"><span class="mface back">★</span><span class="mface front"><img src="${c.img}" alt=""><small>${esc(c.name)}</small></span></span></button>`).join("");
      $("mm-win").innerHTML = ""; $("mm-moves").textContent = 0; $("mm-found").textContent = `0 / ${pairs}`; $("mm-time").textContent = "0:00";
      const best = store.get(`memory-best-${pairs}`, null); $("mm-best").textContent = best ? `${best} moves` : "–";
      grid.onclick = e => {
        const b = e.target.closest(".mcard"); if (!b || lock || b.classList.contains("up") || b.classList.contains("got")) return;
        if (!timer) timer = setInterval(() => { secs++; $("mm-time") && ($("mm-time").textContent = timeText(secs)); }, 1000);
        b.classList.add("up"); b.setAttribute("aria-label", cards[b.dataset.i].name); up.push(b);
        if (up.length < 2) return;
        moves++; $("mm-moves").textContent = moves; lock = true;
        const [a, c] = up.map(x => cards[x.dataset.i]);
        if (a.pair === c.pair) {
          setTimeout(() => {
            up.forEach(x => x.classList.add("got")); up = []; lock = false; found++; $("mm-found").textContent = `${found} / ${pairs}`;
            if (found === pairs) {
              clearInterval(timer);
              const best = store.get(`memory-best-${pairs}`, null), record = !best || moves < best; if (record) store.set(`memory-best-${pairs}`, moves);
              $("mm-win").innerHTML = `<div class="win"><span><span class="big">🎉</span> All ${pairs} pairs in ${moves} moves and ${timeText(secs)}!${record ? " New best!" : ""}</span><button class="kbtn" id="mm-again">Play again</button></div>`;
              $("mm-again").onclick = start;
            }
          }, 450);
        } else setTimeout(() => { up.forEach(x => { x.classList.remove("up"); x.setAttribute("aria-label", "Card, face down"); }); up = []; lock = false; }, 1000);
      };
    }
    el.querySelector(".seg-k").addEventListener("click", e => { const b = e.target.closest("[data-pairs]"); if (!b) return; pairs = +b.dataset.pairs; store.set("memory-pairs", pairs); el.querySelectorAll("[data-pairs]").forEach(x => x.setAttribute("aria-pressed", x === b)); start(); });
    $("mm-new").onclick = start;
    stopGame = () => clearInterval(timer);
    start();
  }

  /* ================= Word search ================= */
  const nameWords = id => [...new Set(sections.filter(s => s.id === id).flatMap(s => ["good", "bad"].flatMap(k => (s[k] || []).map(([n]) => n.toUpperCase()))).filter(w => /^[A-Z]{3,9}$/.test(w)))];
  const THEMES = {
    mario: ["Super Mario", () => nameWords("mario")],
    paw: ["PAW Patrol", () => nameWords("paw")],
    animals: ["Animals", () => ["LION", "TIGER", "ZEBRA", "HORSE", "MONKEY", "RABBIT", "TURTLE", "PANDA", "KOALA", "EAGLE", "SHARK", "WHALE", "GIRAFFE", "CAMEL", "PARROT", "DOLPHIN"]],
    fruits: ["Fruits", () => ["APPLE", "MANGO", "BANANA", "GRAPE", "LEMON", "PEACH", "CHERRY", "ORANGE", "KIWI", "MELON", "PLUM", "GUAVA", "PAPAYA", "BERRY"]],
    space: ["Space", () => ["PLANET", "ROCKET", "MOON", "STAR", "COMET", "SUN", "EARTH", "MARS", "ORBIT", "GALAXY", "SATURN", "VENUS", "ALIEN", "METEOR"]],
    colours: ["Colours", () => ["RED", "BLUE", "GREEN", "YELLOW", "ORANGE", "PURPLE", "PINK", "BROWN", "BLACK", "WHITE", "GREY", "GOLD", "SILVER"]]
  };
  const LEVELS = {
    easy: { name: "Easy", n: 8, words: 6, dirs: [[0, 1], [1, 0]] },
    medium: { name: "Medium", n: 10, words: 8, dirs: [[0, 1], [1, 0], [1, 1]] },
    hard: { name: "Hard", n: 12, words: 10, dirs: [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]] }
  };
  const FOUND_COLOURS = ["#fde68a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#ddd6fe", "#fed7aa", "#a5f3fc", "#d9f99d", "#fecaca", "#e9d5ff"];
  function wordSearch(el) {
    let theme = store.get("ws-theme", "animals"), level = store.get("ws-level", "easy");
    el.innerHTML = header("🔤 Word search", "Find every word in the grid. Drag across a word, or tap its first letter and then its last letter.") + `
      <div class="krow">${seg("theme", Object.entries(THEMES).map(([k, [t]]) => [k, t]), theme)}</div>
      <div class="krow" style="margin-top:8px">${seg("level", Object.entries(LEVELS).map(([k, l]) => [k, `${l.name} · ${l.n}×${l.n}`]), level)}<button class="kbtn alt sm" id="ws-new">New puzzle</button></div>
      <div class="ws-wrap"><div class="ws-grid" id="ws-grid"></div>
        <div class="kpanel"><b>Words to find</b> <span class="kstat" id="ws-count" style="display:inline"></span><div class="ws-words" id="ws-words" style="margin-top:10px"></div>
          <p class="sub" style="margin:12px 0 0;font-size:.85rem" id="ws-dirs"></p></div></div><div id="ws-win"></div>`;
    let grid, placed, n, anchor = null, dragging = false, startCell = null;
    function make() {
      const L = LEVELS[level]; n = L.n;
      const pool = shuffle(THEMES[theme][1]().filter(w => w.length <= n));
      grid = Array.from({ length: n }, () => Array(n).fill(null)); placed = [];
      for (const w of pool) {
        if (placed.length >= L.words) break;
        for (let t = 0; t < 300; t++) {
          const [dr, dc] = L.dirs[rand(0, L.dirs.length - 1)], r = rand(0, n - 1), c = rand(0, n - 1);
          const er = r + dr * (w.length - 1), ec = c + dc * (w.length - 1);
          if (er < 0 || ec < 0 || er >= n || ec >= n) continue;
          const cells = [...w].map((_, i) => [r + dr * i, c + dc * i]);
          if (!cells.every(([y, x], i) => !grid[y][x] || grid[y][x] === w[i])) continue;
          cells.forEach(([y, x], i) => grid[y][x] = w[i]);
          placed.push({ w, cells, found: false }); break;
        }
      }
      const AZ = "ABCDEFGHIJKLMNOPRSTUVWY";
      grid = grid.map(row => row.map(ch => ch || AZ[rand(0, AZ.length - 1)]));
      $("ws-dirs").textContent = { easy: "Words go across → and down ↓.", medium: "Words go across, down and diagonally ↘.", hard: "Words go in any direction, even backwards!" }[level];
      $("ws-win").innerHTML = ""; anchor = null; draw();
    }
    function draw() {
      const g = $("ws-grid"); g.style.gridTemplateColumns = `repeat(${n}, auto)`;
      const colourOf = {}; placed.forEach((p, i) => p.found && p.cells.forEach(([y, x]) => colourOf[`${y},${x}`] = FOUND_COLOURS[i % FOUND_COLOURS.length]));
      g.innerHTML = grid.map((row, y) => row.map((ch, x) => `<div class="ws-cell${colourOf[`${y},${x}`] ? " found" : ""}" data-y="${y}" data-x="${x}"${colourOf[`${y},${x}`] ? ` style="background:${colourOf[`${y},${x}`]}"` : ""}>${ch}</div>`).join("")).join("");
      $("ws-words").innerHTML = placed.map(p => `<span class="${p.found ? "done" : ""}">${p.w}</span>`).join("");
      $("ws-count").textContent = `(${placed.filter(p => p.found).length} of ${placed.length})`;
    }
    const cellAt = (cx, cy) => document.elementFromPoint(cx, cy)?.closest?.(".ws-cell");
    const lineCells = (a, b) => {
      const dy = b[0] - a[0], dx = b[1] - a[1];
      if (!(dy === 0 || dx === 0 || Math.abs(dy) === Math.abs(dx))) return null;
      const len = Math.max(Math.abs(dy), Math.abs(dx)), sy = Math.sign(dy), sx = Math.sign(dx);
      return Array.from({ length: len + 1 }, (_, i) => [a[0] + sy * i, a[1] + sx * i]);
    };
    const pos = c => [+c.dataset.y, +c.dataset.x];
    function preview(cells) { document.querySelectorAll(".ws-cell.sel").forEach(c => c.classList.remove("sel")); (cells || []).forEach(([y, x]) => document.querySelector(`.ws-cell[data-y="${y}"][data-x="${x}"]`)?.classList.add("sel")); }
    function check(a, b) {
      const cells = lineCells(a, b); preview(null); if (!cells) return false;
      const key = cells.map(c => c.join()).join("|");
      const hit = placed.find(p => !p.found && (p.cells.map(c => c.join()).join("|") === key || [...p.cells].reverse().map(c => c.join()).join("|") === key));
      if (!hit) return false;
      hit.found = true; draw();
      if (placed.every(p => p.found)) {
        $("ws-win").innerHTML = `<div class="win"><span><span class="big">🎉</span> You found all ${placed.length} words!</span><button class="kbtn" id="ws-again">New puzzle</button></div>`;
        $("ws-again").onclick = make;
      }
      return true;
    }
    const g = $("ws-grid");
    g.addEventListener("pointerdown", e => { const c = e.target.closest(".ws-cell"); if (!c) return; e.preventDefault(); dragging = true; startCell = pos(c); preview([startCell]); });
    g.addEventListener("pointermove", e => { if (!dragging) return; const c = cellAt(e.clientX, e.clientY); if (c) preview(lineCells(startCell, pos(c)) || [startCell]); });
    addEventListener("pointerup", function up(e) {
      if (!document.body.contains(g)) { removeEventListener("pointerup", up); return; }
      if (!dragging) return; dragging = false;
      const c = cellAt(e.clientX, e.clientY), end = c ? pos(c) : startCell;
      if (end[0] !== startCell[0] || end[1] !== startCell[1]) { check(startCell, end); clearAnchor(); return; }
      // A tap: first tap sets the start letter, second tap checks the word
      if (anchor && (anchor[0] !== end[0] || anchor[1] !== end[1])) { check(anchor, end); clearAnchor(); }
      else if (anchor) clearAnchor();
      else { anchor = end; preview(null); document.querySelector(`.ws-cell[data-y="${end[0]}"][data-x="${end[1]}"]`)?.classList.add("anchor"); }
    });
    const clearAnchor = () => { anchor = null; document.querySelectorAll(".ws-cell.anchor").forEach(c => c.classList.remove("anchor")); };
    el.querySelectorAll(".seg-k").forEach(s => s.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.theme) { theme = b.dataset.theme; store.set("ws-theme", theme); el.querySelectorAll("[data-theme]").forEach(x => x.setAttribute("aria-pressed", x === b)); }
      if (b.dataset.level) { level = b.dataset.level; store.set("ws-level", level); el.querySelectorAll("[data-level]").forEach(x => x.setAttribute("aria-pressed", x === b)); }
      make();
    }));
    $("ws-new").onclick = make;
    make();
  }

  /* ================= Numbers ================= */
  function numbers(el) {
    let op = store.get("math-op", "add"), lvl = store.get("math-level", "easy"), table = store.get("math-table", 0);
    const OPS = [["add", "➕ Adding"], ["sub", "➖ Taking away"], ["mul", "✖️ Times tables"], ["mix", "🔀 Mix"]];
    const LV = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]];
    el.innerHTML = header("➕ Numbers", "Answer 10 questions. Type the answer or use the number buttons, then press ✓.") + `
      <div class="krow">${seg("op", OPS, op)}</div>
      <div class="krow" style="margin-top:8px">${seg("lvl", LV, lvl)}<span class="sub" style="margin:0;font-size:.85rem" id="m-range"></span></div>
      <div class="krow" style="margin-top:8px" id="m-tables-row"><span style="font-size:.9rem;font-weight:600">Table:</span><div class="tables" id="m-tables">${[0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(t => `<button type="button" data-t="${t}" aria-pressed="${t === table}">${t ? t : "Any"}</button>`).join("")}</div></div>
      <div class="kpanel math" id="m-box"></div>`;
    const RANGE = { add: { easy: "sums up to 10", medium: "numbers up to 20", hard: "numbers up to 100" }, sub: { easy: "numbers up to 10", medium: "numbers up to 20", hard: "numbers up to 100" },
      mul: { easy: "tables 1 to 5", medium: "tables 1 to 10", hard: "tables 2 to 12" }, mix: { easy: "easy mix", medium: "medium mix", hard: "hard mix" } };
    function question(o) {
      if (o === "mix") o = ["add", "sub", "mul"][rand(0, 2)];
      if (o === "add") { const [a, b] = lvl === "easy" ? (x => [x, rand(0, 10 - x)])(rand(0, 10)) : lvl === "medium" ? [rand(1, 20), rand(1, 20)] : [rand(10, 99), rand(10, 99)]; return { a, b, s: "+", ans: a + b }; }
      if (o === "sub") { const top = lvl === "easy" ? 10 : lvl === "medium" ? 20 : 100, a = rand(lvl === "hard" ? 20 : 1, top), b = rand(0, a); return { a, b, s: "−", ans: a - b }; }
      const t = op === "mul" && table ? table : lvl === "easy" ? rand(1, 5) : lvl === "medium" ? rand(1, 10) : rand(2, 12);
      const k = lvl === "hard" ? rand(2, 12) : rand(1, 10);
      return { a: t, b: k, s: "×", ans: t * k };
    }
    let qs, i, typed, results, busy;
    function start() {
      $("m-range").textContent = `(${RANGE[op][lvl]})`; $("m-tables-row").hidden = op !== "mul";
      qs = []; const seen = new Set();
      while (qs.length < 10) { const q = question(op), k = `${q.a}${q.s}${q.b}`; if (!seen.has(k) || seen.size > 40) { seen.add(k); qs.push(q); } }
      i = 0; results = []; drawQ();
    }
    const helper = q => {
      if (q.s === "+" && q.ans <= 10) return `${"🍎".repeat(q.a)}${q.a && q.b ? " + " : ""}${"🍏".repeat(q.b)}`;
      if (q.s === "−" && q.a <= 10) return `${"🍎".repeat(q.a - q.b)}<span class="gone">${"🍎".repeat(q.b)}</span>`;
      if (q.s === "×" && q.a * q.b <= 30 && q.ans > 0) return `<span class="dots" style="grid-template-columns:repeat(${q.b}, 14px)">${"<i></i>".repeat(q.a * q.b)}</span>`;
      return "";
    };
    function drawQ(state) {
      const q = qs[i];
      $("m-box").innerHTML = `<div class="progress-dots">${qs.map((_, k) => `<i class="${k < results.length ? (results[k].ok ? "ok" : "no") : k === i ? "cur" : ""}"></i>`).join("")}</div>
        <p class="sub" style="text-align:center;margin:0">Question ${i + 1} of ${qs.length}</p>
        <div class="math-q ${state || ""}" aria-live="polite">${q.a} ${q.s} ${q.b} = <span class="ans">${typed || "?"}</span></div>
        <div class="helper" aria-hidden="true">${lvl === "easy" ? helper(q) : ""}</div>
        <div class="feedback" id="m-fb"></div>
        <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `<button data-d="${d}">${d}</button>`).join("")}<button data-del aria-label="Delete">⌫</button><button data-d="0">0</button><button class="go" data-go aria-label="Check answer">✓</button></div>`;
    }
    function press(d) { if (busy) return; typed = (typed + d).replace(/^0+(?=\d)/, "").slice(0, 4); $("m-box").querySelector(".ans").textContent = typed; }
    function submit() {
      if (busy || !typed) return; busy = true;
      const q = qs[i], ok = +typed === q.ans; results.push({ q, given: +typed, ok });
      const box = $("m-box"); box.querySelector(".math-q").classList.add(ok ? "right" : "wrong");
      $("m-fb").className = "feedback " + (ok ? "ok" : "no");
      $("m-fb").textContent = ok ? ["Correct! 🌟", "Great job! 🎉", "Super! ⭐", "Well done! 👏"][rand(0, 3)] : `Not quite. ${q.a} ${q.s} ${q.b} = ${q.ans}`;
      setTimeout(() => { busy = false; typed = ""; i++; i < qs.length ? drawQ() : finish(); }, ok ? 900 : 2000);
    }
    function finish() {
      const score = results.filter(r => r.ok).length, key = `math-best-${op}-${lvl}${op === "mul" && table ? "-" + table : ""}`;
      const best = store.get(key, 0), record = score > best; if (record) store.set(key, score);
      const stars = score === 10 ? "⭐⭐⭐" : score >= 7 ? "⭐⭐" : score >= 4 ? "⭐" : "💪";
      const wrong = results.filter(r => !r.ok);
      $("m-box").innerHTML = `<div style="text-align:center"><div style="font-size:2.6rem">${stars}</div><h2 style="margin:6px 0">${score} out of 10!</h2>
        <p class="sub" style="margin:0">${score === 10 ? "Perfect score!" : score >= 7 ? "Great work!" : "Keep practising, you're getting better!"}${record ? " New best!" : ` Best: ${Math.max(best, score)} / 10`}</p></div>
        ${wrong.length ? `<p style="margin:14px 0 0;font-weight:700">Let's remember these:</p><ol class="mistakes">${wrong.map(r => `<li>${r.q.a} ${r.q.s} ${r.q.b} = <b>${r.q.ans}</b> <span class="sub" style="margin:0">(you said ${r.given})</span></li>`).join("")}</ol>` : ""}
        <div class="krow" style="justify-content:center;margin-top:16px"><button class="kbtn" id="m-again">Play again</button></div>`;
      $("m-again").onclick = start;
    }
    $("m-box").addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.d != null) press(b.dataset.d);
      if (b.hasAttribute("data-del")) { typed = typed.slice(0, -1); $("m-box").querySelector(".ans").textContent = typed || "?"; }
      if (b.hasAttribute("data-go")) submit();
    });
    const key = e => {
      if (!$("m-box")?.querySelector(".keypad") || e.target.closest("input, textarea")) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") { typed = typed.slice(0, -1); $("m-box").querySelector(".ans").textContent = typed || "?"; }
      else if (e.key === "Enter") submit();
    };
    addEventListener("keydown", key); stopGame = () => removeEventListener("keydown", key);
    el.querySelectorAll(".seg-k").forEach(s => s.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.op) { op = b.dataset.op; store.set("math-op", op); el.querySelectorAll("[data-op]").forEach(x => x.setAttribute("aria-pressed", x === b)); }
      if (b.dataset.lvl) { lvl = b.dataset.lvl; store.set("math-level", lvl); el.querySelectorAll("[data-lvl]").forEach(x => x.setAttribute("aria-pressed", x === b)); }
      typed = ""; busy = false; start();
    }));
    $("m-tables").addEventListener("click", e => { const b = e.target.closest("[data-t]"); if (!b) return; table = +b.dataset.t; store.set("math-table", table); $("m-tables").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); typed = ""; busy = false; start(); });
    typed = ""; busy = false; start();
  }

  /* ================= Travel blog ================= */
  // Trips are kept in this browser only: this website is public, so nothing a child writes is published.
  function travel(el) {
    let trips = store.get("trips", []), editing = null, draft = null, query = "";
    const fmt = d => d ? new Date(d + "T12:00").toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : "";
    const span = t => t.to && t.to !== t.from ? `${fmt(t.from)} – ${fmt(t.to)}` : fmt(t.from);
    const days = t => t.to && t.to > t.from ? Math.round((new Date(t.to) - new Date(t.from)) / 864e5) + 1 : 1;
    const save = () => { if (store.set("trips", trips)) return true; alertBox("Your device's storage is full. Remove some photos or older trips, then try again."); return false; };
    const alertBox = msg => { const n = $("tv-msg"); if (n) { n.textContent = msg; n.hidden = false; } };
    function render() {
      const places = new Set(trips.map(t => t.place.trim().toLowerCase()).filter(Boolean));
      const learned = trips.reduce((s, t) => s + (t.learned ? t.learned.split("\n").filter(x => x.trim()).length : 0), 0);
      const list = trips.filter(t => !query || [t.title, t.place, t.learned, t.fav].join(" ").toLowerCase().includes(query)).sort((a, b) => b.from.localeCompare(a.from));
      let year = null;
      el.innerHTML = `<h1>✈️ Travel blog</h1><p class="sub">My trips: where I went, when I went, and what I learned on the way.</p>
        <div class="tv-stats"><div><b>${trips.length}</b><span>trips</span></div><div><b>${places.size}</b><span>places visited</span></div><div><b>${trips.reduce((s, t) => s + days(t), 0)}</b><span>days of travel</span></div><div><b>${learned}</b><span>things learned</span></div></div>
        <div class="krow"><button class="kbtn teal" id="tv-add">＋ Add a trip</button>${trips.length ? `<input type="search" id="tv-q" placeholder="Search my trips…" aria-label="Search trips" value="${esc(query)}" style="flex:1;min-width:180px;max-width:320px">` : ""}</div>
        <p class="confirm-k" id="tv-msg" hidden></p>
        <div id="tv-form-slot"></div>
        ${trips.length ? `<div class="trips">${list.map(t => { const y = t.from.slice(0, 4), head = y !== year ? `<h2 class="tv-year">${y}</h2>` : ""; year = y; return head + tripCard(t); }).join("") || `<p class="sub">No trips match “${esc(query)}”.</p>`}</div>`
          : `<div class="empty-trips"><div class="big">🗺️</div><p><b>No trips yet.</b><br>Add your first adventure: a holiday, a visit to family, a museum or a day at the beach!</p></div>`}
        <div class="kpanel" style="margin-top:22px"><b>Keep your blog safe</b><p class="tv-note">Trips are saved only in this browser on this device. They aren't published on this website, so other visitors can't see them. Download a backup now and then, and use it to move the blog to another device.</p>
          <div class="krow" style="margin-top:10px"><button class="kbtn alt sm" id="tv-export" ${trips.length ? "" : "disabled"}>Download backup</button><label class="kbtn alt sm" style="cursor:pointer">Restore a backup<input type="file" id="tv-import" accept="application/json" hidden></label></div></div>`;
      if (editing !== null) form();
    }
    const tripCard = t => {
      const photos = t.photos || [], learned = (t.learned || "").split("\n").map(x => x.trim()).filter(Boolean);
      return `<article class="trip${photos.length ? "" : " nophoto"}" id="trip-${t.id}">
        ${photos.length ? `<div class="trip-photos"><img src="${photos[0]}" alt="Photo from ${esc(t.place)}" data-zoom>${photos.length > 1 ? `<div class="more">${photos.slice(1).map(p => `<img src="${p}" alt="" data-zoom>`).join("")}</div>` : ""}</div>` : ""}
        <div class="trip-body"><h3>${esc(t.title || t.place)}</h3>
          <div class="trip-meta"><span>📅 ${esc(span(t))}${days(t) > 1 ? ` · ${days(t)} days` : ""}</span><span>📍 ${esc(t.place)}</span>${t.fun ? `<span aria-label="${t.fun} out of 5 for fun">${"⭐".repeat(t.fun)}</span>` : ""}</div>
          ${learned.length ? `<h4>Things I learned</h4><ol>${learned.map(x => `<li>${esc(x)}</li>`).join("")}</ol>` : ""}
          ${t.fav ? `<h4>My favourite part</h4><blockquote>${esc(t.fav)}</blockquote>` : ""}
          <div class="trip-acts"><button class="kbtn alt sm" data-edit="${t.id}">Edit</button><button class="kbtn alt sm" data-del="${t.id}">Delete</button></div>
          <div class="confirm-k" data-confirm="${t.id}" hidden>Delete this trip for good? <button class="kbtn sm" style="background:var(--no)" data-delyes="${t.id}">Yes, delete</button><button class="kbtn alt sm" data-delno>Keep it</button></div>
        </div></article>`;
    };
    function form() {
      const t = draft;
      $("tv-form-slot").innerHTML = `<form class="kpanel tv-form" id="tv-form">
        <h2>${editing === "new" ? "Add a trip" : "Edit trip"}</h2>
        <div class="tv-grid">
          <label>Where did you go?<input name="place" required maxlength="80" placeholder="e.g. Niagara Falls, Canada" value="${esc(t.place)}"></label>
          <label>Trip name <small>(optional)</small><input name="title" maxlength="80" placeholder="e.g. Rainbow at the waterfall" value="${esc(t.title)}"></label>
          <label>Date I went<input type="date" name="from" required value="${esc(t.from)}"></label>
          <label>Date I came back <small>(optional)</small><input type="date" name="to" value="${esc(t.to)}"></label>
        </div>
        <label>Things I learned <small>(one on each line)</small><textarea name="learned" placeholder="Waterfalls make mist that can make rainbows.&#10;Canada and the USA share Niagara Falls.">${esc(t.learned)}</textarea></label>
        <label>My favourite part<textarea name="fav" placeholder="The boat ride right up to the falls!">${esc(t.fav)}</textarea></label>
        <div><b style="font-size:.92rem">How much fun was it?</b><div class="stars" id="tv-stars">${[1, 2, 3, 4, 5].map(k => `<button type="button" data-fun="${k}" class="${k <= t.fun ? "on" : ""}" aria-label="${k} star${k > 1 ? "s" : ""}">⭐</button>`).join("")}</div></div>
        <div><b style="font-size:.92rem">Photos</b> <small class="sub">(up to 4)</small>
          <div class="thumbs" id="tv-thumbs" style="margin-top:8px">${t.photos.map((p, k) => `<figure><img src="${p}" alt=""><button type="button" data-rm="${k}" aria-label="Remove photo">✕</button></figure>`).join("")}</div>
          ${t.photos.length < 4 ? `<label class="kbtn alt sm" style="margin-top:8px;cursor:pointer;display:inline-flex">📷 Add photos<input type="file" id="tv-photo" accept="image/*" multiple hidden></label>` : ""}</div>
        <div class="krow"><button class="kbtn teal" type="submit">${editing === "new" ? "Save trip" : "Save changes"}</button><button class="kbtn alt" type="button" id="tv-cancel">Cancel</button></div>
      </form>`;
      const f = $("tv-form");
      const keep = () => { const d = new FormData(f); ["place", "title", "from", "to", "learned", "fav"].forEach(k => t[k] = String(d.get(k) || "")); };
      f.addEventListener("submit", e => {
        e.preventDefault(); keep();
        if (t.to && t.to < t.from) { alertBox("The date you came back is before the date you went. Please check the dates."); return; }
        t.place = t.place.trim(); t.title = t.title.trim();
        const before = JSON.stringify(trips);
        if (editing === "new") trips.push({ ...t, id: Date.now().toString(36) }); else trips = trips.map(x => x.id === editing ? { ...t } : x);
        if (!save()) { trips = JSON.parse(before); return; }
        const id = editing === "new" ? trips[trips.length - 1].id : editing;
        editing = null; draft = null; render();
        document.getElementById("trip-" + id)?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      $("tv-cancel").onclick = () => { editing = null; draft = null; render(); };
      $("tv-stars").onclick = e => { const b = e.target.closest("[data-fun]"); if (!b) return; keep(); t.fun = +b.dataset.fun === t.fun ? 0 : +b.dataset.fun; form(); };
      $("tv-thumbs").onclick = e => { const b = e.target.closest("[data-rm]"); if (!b) return; keep(); t.photos.splice(+b.dataset.rm, 1); form(); };
      $("tv-photo")?.addEventListener("change", async e => {
        keep();
        for (const file of [...e.target.files].slice(0, 4 - t.photos.length)) { try { t.photos.push(await shrink(file)); } catch {} }
        form();
      });
      f.scrollIntoView({ behavior: "smooth", block: "start" });
      f.querySelector("input").focus({ preventScroll: true });
    }
    // Photos are resized before saving so many trips fit in the browser's storage
    const shrink = file => new Promise((res, rej) => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => { const k = Math.min(1, 900 / Math.max(im.width, im.height)), cv = document.createElement("canvas"); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
        cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url); res(cv.toDataURL("image/jpeg", .75)); };
      im.onerror = () => { URL.revokeObjectURL(url); rej(); }; im.src = url;
    });
    el.onclick = e => {
      const b = e.target.closest("button, img[data-zoom]"); if (!b) return;
      if (b.id === "tv-add") { editing = "new"; draft = { place: "", title: "", from: new Date().toISOString().slice(0, 10), to: "", learned: "", fav: "", fun: 0, photos: [] }; form(); }
      if (b.dataset.edit) { editing = b.dataset.edit; const t = trips.find(x => x.id === editing); draft = { ...t, photos: [...(t.photos || [])] }; form(); }
      if (b.dataset.del) el.querySelector(`[data-confirm="${b.dataset.del}"]`).hidden = false;
      if (b.hasAttribute("data-delno")) b.closest("[data-confirm]").hidden = true;
      if (b.dataset.delyes) { trips = trips.filter(x => x.id !== b.dataset.delyes); save(); render(); }
      if (b.id === "tv-export") { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify({ trips }, null, 1)], { type: "application/json" })); a.download = `travel-blog-${new Date().toISOString().slice(0, 10)}.json`; a.click(); }
      if (b.dataset.zoom !== undefined && b.tagName === "IMG") { const lb = document.createElement("div"); lb.className = "lightbox"; lb.innerHTML = `<img src="${b.src}" alt="">`; lb.onclick = () => lb.remove(); document.body.append(lb); }
    };
    el.oninput = e => { if (e.target.id === "tv-q") { query = e.target.value.trim().toLowerCase(); const pos = e.target.selectionStart; render(); const q = $("tv-q"); q.focus(); q.setSelectionRange(pos, pos); } };
    el.onchange = async e => {
      if (e.target.id !== "tv-import") return;
      try { const d = JSON.parse(await e.target.files[0].text()); if (!Array.isArray(d.trips)) throw 0; trips = d.trips; save(); render(); }
      catch { alertBox("That file isn't a travel blog backup."); }
    };
    render();
  }

  route();
})();
