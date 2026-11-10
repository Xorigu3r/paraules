/* Paraules · Xoriguer — motor del joc (sense DOM).
   Funciona igual al navegador (window.Motor) i a Node (require('./motor.js')).
   Diccionaris: dades/ca.dawg, dades/es.dawg (vegeu eines/fer_diccionaris.py). */
(function (root) {
  'use strict';

  var N = 15, CEN = 7 * N + 7, RACK = 7, BINGO = 50, BLANK = 31;

  /* ---------- Idiomes: alfabet intern, com es mostra cada fitxa, quantes n'hi ha i quant val */
  var LANGS = {
    ca: {
      alfa: 'ABCDEFGHIJLMNOPQRSTUVXZÇŁŊ',
      show: { 'Ł': 'L·L', 'Ŋ': 'NY', 'Q': 'QU' },
      // lletra: [quantes, punts]
      tiles: {
        A: [12, 1], E: [13, 1], I: [8, 1], O: [5, 1], U: [4, 1], R: [8, 1], S: [8, 1], N: [6, 1],
        L: [4, 1], T: [5, 1], C: [3, 2], D: [3, 2], M: [3, 2], B: [2, 3], G: [2, 3], P: [2, 3],
        F: [1, 4], V: [1, 4], H: [1, 8], J: [1, 8], Q: [1, 8], Z: [1, 8],
        'Ç': [1, 10], 'Ł': [1, 10], 'Ŋ': [1, 10], X: [1, 10]
      },
      blanks: 2,
      vowels: 'AEIOU'
    },
    es: {
      alfa: 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ',
      show: {},
      tiles: {
        A: [12, 1], E: [12, 1], O: [9, 1], I: [6, 1], S: [6, 1], N: [5, 1], L: [5, 1], R: [6, 1],
        U: [5, 1], T: [4, 1], D: [5, 2], G: [2, 2], C: [5, 3], B: [2, 3], M: [2, 3], P: [2, 3],
        H: [2, 4], F: [1, 4], V: [1, 4], Y: [1, 4], Q: [1, 5], J: [1, 8], 'Ñ': [1, 8], X: [1, 8],
        Z: [1, 10], K: [0, 8], W: [0, 8]
      },
      blanks: 2,
      vowels: 'AEIOU'
    }
  };

  function prepLang(code) {
    var L = LANGS[code];
    if (L.ready) return L;
    L.code = code;
    L.n = L.alfa.length;
    L.val = [];
    L.count = [];
    L.isVowel = [];
    for (var i = 0; i < L.n; i++) {
      var ch = L.alfa[i], t = L.tiles[ch] || [0, 0];
      L.count[i] = t[0];
      L.val[i] = t[1];
      L.isVowel[i] = L.vowels.indexOf(ch) >= 0;
    }
    L.all = (L.n >= 32) ? 0xffffffff : ((1 << L.n) - 1) >>> 0;
    L.ready = true;
    return L;
  }

  function letterText(L, li) { var ch = L.alfa[li]; return L.show[ch] || ch; }

  /* Converteix text escrit (p.ex. "pal·lid", "canya", "quatre") a l'alfabet intern. -1 si no es pot */
  function encode(L, txt) {
    var s = String(txt).toUpperCase().normalize('NFC');
    if (L.code === 'ca') {
      s = s.replace(/L[·.ŀ]L|ĿL/g, 'Ł').replace(/NY/g, 'Ŋ').replace(/QÜ|QU/g, 'Q');
    }
    var keep = L.code === 'ca' ? 'ÇŁŊ' : 'Ñ';
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (keep.indexOf(ch) < 0) ch = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
      var li = L.alfa.indexOf(ch);
      if (li < 0) return null;
      out.push(li);
    }
    return out;
  }

  /* ---------- Diccionari (DAWG) */
  function Dict(buf) {
    this.d = buf instanceof Uint32Array ? buf : new Uint32Array(buf);
  }
  // troba l'aresta de la lletra li dins del node que comenca a e; -1 si no hi es
  Dict.prototype.edge = function (e, li) {
    if (e === 0) return -1;
    var d = this.d;
    for (;;) {
      var v = d[e];
      if ((v & 63) === li) return e;
      if (v & 128) return -1;
      e++;
    }
  };
  Dict.prototype.has = function (word) {
    var e = 1, v = 0;
    for (var i = 0; i < word.length; i++) {
      var x = this.edge(e, word[i]);
      if (x < 0) return false;
      v = this.d[x];
      e = v >>> 8;
    }
    return word.length > 0 && !!(v & 64);
  };

  /* ---------- Tauler: caselles de premi (disseny propi, simetric) */
  // 0 res, 1 lletra x2, 2 lletra x3, 3 paraula x2, 4 paraula x3
  var PREM = (function () {
    var q = {};
    function put(r, c, k) { q[r + ',' + c] = k; q[c + ',' + r] = k; }
    put(0, 3, 4);
    put(2, 2, 3); put(4, 6, 3);
    put(0, 0, 2); put(1, 4, 2); put(5, 5, 2);
    put(2, 5, 1); put(3, 7, 1); put(6, 6, 1); put(0, 7, 1);
    var p = new Uint8Array(N * N);
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      var rr = r > 7 ? 14 - r : r, cc = c > 7 ? 14 - c : c;
      p[r * N + c] = q[rr + ',' + cc] || 0;
    }
    p[CEN] = 3;
    return p;
  })();
  var LMUL = [1, 2, 3, 1, 1], WMUL = [1, 1, 1, 2, 3];

  /* ---------- Atzar amb llavor (per a proves i per a partides online iguals a tots els aparells) */
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  /* ---------- Estat de la partida */
  function newGame(lang, nPlayers, seed) {
    var L = prepLang(lang);
    var R = rng(seed == null ? (Math.random() * 4294967296) >>> 0 : seed);
    var bag = [];
    for (var i = 0; i < L.n; i++) for (var k = 0; k < L.count[i]; k++) bag.push(i);
    for (k = 0; k < L.blanks; k++) bag.push(BLANK);
    for (i = bag.length - 1; i > 0; i--) { var j = Math.floor(R() * (i + 1)); var t = bag[i]; bag[i] = bag[j]; bag[j] = t; }
    var S = {
      lang: lang, n: nPlayers || 2,
      board: new Int8Array(N * N).fill(-1),  // lletra o -1
      blank: new Uint8Array(N * N),           // 1 si es un escarras
      bag: bag, racks: [], scores: [], turn: 0, scoreless: 0, moves: 0,
      over: false, last: null, seed: R
    };
    for (var p = 0; p < S.n; p++) { S.racks.push(bag.splice(0, RACK)); S.scores.push(0); }
    return S;
  }

  function cloneS(S) {
    return {
      lang: S.lang, n: S.n, board: S.board.slice(), blank: S.blank.slice(), bag: S.bag.slice(),
      racks: S.racks.map(function (r) { return r.slice(); }), scores: S.scores.slice(),
      turn: S.turn, scoreless: S.scoreless, moves: S.moves, over: S.over, last: S.last, seed: S.seed
    };
  }

  function boardEmpty(S) { return S.board[CEN] < 0; }

  /* ---------- Avaluacio d'una jugada: comprova i puntua.
     tiles: [{i: casella, l: lletra, b: 1 si escarras}]. Retorna {ok, score, words:[[lletres]], err} */
  function evalPlacement(S, dict, tiles) {
    var L = prepLang(S.lang), B = S.board;
    if (!tiles.length) return { ok: false, err: 'buida' };
    var rows = {}, cols = {}, set = {};
    for (var k = 0; k < tiles.length; k++) {
      var t = tiles[k];
      if (t.i < 0 || t.i >= N * N || B[t.i] >= 0 || set[t.i]) return { ok: false, err: 'casella' };
      set[t.i] = t;
      rows[(t.i / N) | 0] = 1; cols[t.i % N] = 1;
    }
    var nr = Object.keys(rows).length, nc = Object.keys(cols).length;
    if (nr > 1 && nc > 1) return { ok: false, err: 'linia' };
    var dir;  // 0 horitzontal, 1 vertical
    if (tiles.length === 1) {
      var i0 = tiles[0].i, r0 = (i0 / N) | 0, c0 = i0 % N;
      var h = (c0 > 0 && B[i0 - 1] >= 0) || (c0 < N - 1 && B[i0 + 1] >= 0);
      dir = h ? 0 : 1;
    } else dir = nr === 1 ? 0 : 1;
    var step = dir === 0 ? 1 : N;
    function at(i) { return set[i] ? set[i].l : B[i]; }
    function inLine(i, j) { return dir === 0 ? ((i / N) | 0) === ((j / N) | 0) : true; }
    var idx = tiles.map(function (t) { return t.i; }).sort(function (a, b) { return a - b; });
    var a = idx[0], z = idx[idx.length - 1];
    for (var x = a; x <= z; x += step) if (at(x) < 0) return { ok: false, err: 'forat' };
    while (a - step >= 0 && inLine(a - step, a) && at(a - step) >= 0) a -= step;
    while (z + step < N * N && inLine(z + step, z) && at(z + step) >= 0) z += step;

    var words = [], total = 0, touches = false, mainW = [];
    var sum = 0, wm = 1;
    for (x = a; x <= z; x += step) {
      var tt = set[x];
      mainW.push(at(x));
      if (tt) {
        var pv = tt.b ? 0 : L.val[tt.l];
        sum += pv * LMUL[PREM[x]]; wm *= WMUL[PREM[x]];
      } else { touches = true; sum += S.blank[x] ? 0 : L.val[B[x]]; }
    }
    if (mainW.length >= 2) { words.push(mainW); total += sum * wm; }
    // paraules creuades
    var cstep = dir === 0 ? N : 1;
    for (k = 0; k < tiles.length; k++) {
      t = tiles[k];
      var s0 = t.i, s1 = t.i;
      var cin = function (p, q) { return cstep === 1 ? ((p / N) | 0) === ((q / N) | 0) : true; };
      while (s0 - cstep >= 0 && cin(s0 - cstep, s0) && B[s0 - cstep] >= 0) s0 -= cstep;
      while (s1 + cstep < N * N && cin(s1 + cstep, s1) && B[s1 + cstep] >= 0) s1 += cstep;
      if (s0 === s1) continue;
      touches = true;
      var w = [], cs = 0;
      for (x = s0; x <= s1; x += cstep) {
        if (x === t.i) { w.push(t.l); cs += (t.b ? 0 : L.val[t.l]) * LMUL[PREM[x]]; }
        else { w.push(B[x]); cs += S.blank[x] ? 0 : L.val[B[x]]; }
      }
      words.push(w); total += cs * WMUL[PREM[t.i]];
    }
    if (!words.length) return { ok: false, err: 'curta' };
    if (boardEmpty(S)) { if (!set[CEN]) return { ok: false, err: 'centre' }; }
    else if (!touches) return { ok: false, err: 'aillada' };
    var bad = [];
    for (k = 0; k < words.length; k++) if (!dict.has(words[k])) bad.push(words[k]);
    if (tiles.length === RACK) total += BINGO;
    return { ok: bad.length === 0, err: bad.length ? 'paraula' : null, bad: bad, score: total, words: words, dir: dir };
  }

  /* ---------- Generador de jugades (Appel & Jacobson) */
  function genMoves(S, dict, rack) {
    var L = prepLang(S.lang), B = S.board, D = dict.d, ALL = L.all;
    rack = rack || S.racks[S.turn];
    var cnt = new Int8Array(32), nb = 0;
    for (var k = 0; k < rack.length; k++) { if (rack[k] === BLANK) nb++; else cnt[rack[k]]++; }
    var moves = [], seen = {};
    var empty = boardEmpty(S);
    var cross = new Uint32Array(N * N), xsc = new Int16Array(N * N);
    var line = new Int8Array(N), pl = [], plb = [];

    for (var dir = 0; dir < 2; dir++) {
      var id = dir === 0 ? function (r, c) { return r * N + c; } : function (r, c) { return c * N + r; };
      // controls creuats: lletres valides a cada casella buida segons la paraula perpendicular
      for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
        var i = id(r, c);
        if (B[i] >= 0) continue;
        var up = r, dn = r;
        while (up > 0 && B[id(up - 1, c)] >= 0) up--;
        while (dn < N - 1 && B[id(dn + 1, c)] >= 0) dn++;
        if (up === r && dn === r) { cross[i] = ALL; xsc[i] = -1; continue; }
        var e = 1, okp = true, s = 0;
        for (var y = up; y < r; y++) {
          var x = dict.edge(e, B[id(y, c)]);
          if (x < 0) { okp = false; break; }
          e = D[x] >>> 8; s += S.blank[id(y, c)] ? 0 : L.val[B[id(y, c)]];
        }
        for (y = r + 1; y <= dn; y++) s += S.blank[id(y, c)] ? 0 : L.val[B[id(y, c)]];
        var m = 0;
        if (okp && e) {
          for (var ee = e; ; ee++) {
            var v = D[ee], li = v & 63;
            var ok = false;
            if (dn === r) ok = !!(v & 64);
            else {
              var e2 = v >>> 8, v2 = 0, good = true;
              for (y = r + 1; y <= dn; y++) {
                var x2 = dict.edge(e2, B[id(y, c)]);
                if (x2 < 0) { good = false; break; }
                v2 = D[x2]; e2 = v2 >>> 8;
              }
              ok = good && !!(v2 & 64);
            }
            if (ok) m |= (1 << li);
            if (v & 128) break;
          }
        }
        cross[i] = m >>> 0; xsc[i] = s;
      }

      for (r = 0; r < N; r++) {
        for (c = 0; c < N; c++) line[c] = B[id(r, c)];
        var isAnchor = function (c) {
          if (line[c] >= 0) return false;
          if (empty) return id(r, c) === CEN;
          var i = id(r, c);
          return (c > 0 && line[c - 1] >= 0) || (c < N - 1 && line[c + 1] >= 0) || xsc[i] >= 0;
        };
        var lastAnchor = -1;
        for (var a = 0; a < N; a++) {
          if (!isAnchor(a)) continue;
          if (a > 0 && line[a - 1] >= 0) {
            // prefix fix: les fitxes que ja hi ha a l'esquerra
            var p0 = a - 1;
            while (p0 > 0 && line[p0 - 1] >= 0) p0--;
            var en = 1, term = false, okk = true;
            for (var q = p0; q < a; q++) {
              var xx = dict.edge(en, line[q]);
              if (xx < 0) { okk = false; break; }
              en = D[xx] >>> 8; term = !!(D[xx] & 64);
            }
            if (okk) { pl.length = 0; extend(r, a, a, p0, en, false); }
          } else {
            var limit = 0;
            for (q = a - 1; q >= 0 && q > lastAnchor && line[q] < 0; q--) {
              limit++;
            }
            // no comptem caselles que toquen una fitxa (serien ancoratges)
            pl.length = 0;
            left(r, a, 1, limit);
          }
          lastAnchor = a;
        }
      }

      function left(r, a, e, limit) {
        extend(r, a, a, a - pl.length, e, false);
        if (limit <= 0 || e === 0) return;
        for (var ee = e; ; ee++) {
          var v = D[ee], li = v & 63;
          if (cnt[li] > 0) {
            cnt[li]--; pl.push(li); plb.push(0);
            left(r, a, v >>> 8, limit - 1);
            pl.pop(); plb.pop(); cnt[li]++;
          }
          if (nb > 0) {
            nb--; pl.push(li); plb.push(1);
            left(r, a, v >>> 8, limit - 1);
            pl.pop(); plb.pop(); nb++;
          }
          if (v & 128) break;
        }
      }

      // pl: lletres posades a l'esquerra de l'ancoratge (de start a a-1), despres les de la dreta
      function extend(r, a, c, start, e, term) {
        if (c >= N || line[c] < 0) {
          if (term && c > a) record(r, start, c - 1, a);
          if (c >= N || e === 0) return;
          var i = id(r, c), m = cross[i];
          if (!m) return;
          for (var ee = e; ; ee++) {
            var v = D[ee], li = v & 63;
            if (m & (1 << li)) {
              if (cnt[li] > 0) {
                cnt[li]--; pl.push(li); plb.push(0);
                extend(r, a, c + 1, start, v >>> 8, !!(v & 64));
                pl.pop(); plb.pop(); cnt[li]++;
              }
              if (nb > 0) {
                nb--; pl.push(li); plb.push(1);
                extend(r, a, c + 1, start, v >>> 8, !!(v & 64));
                pl.pop(); plb.pop(); nb++;
              }
            }
            if (v & 128) break;
          }
        } else {
          if (e === 0) return;
          var x = dict.edge(e, line[c]);
          if (x < 0) return;
          extend(r, a, c + 1, start, D[x] >>> 8, !!(D[x] & 64));
        }
      }

      function record(r, c0, c1, a) {
        var tiles = [], key = '', sum = 0, wm = 1, extra = 0, word = [];
        var k = 0;
        for (var c = c0; c <= c1; c++) {
          var i = id(r, c);
          if (line[c] >= 0) {
            word.push(line[c]);
            sum += S.blank[i] ? 0 : L.val[line[c]];
          } else {
            var li = pl[k], b = plb[k]; k++;
            word.push(li);
            var pv = b ? 0 : L.val[li];
            sum += pv * LMUL[PREM[i]]; wm *= WMUL[PREM[i]];
            if (xsc[i] >= 0) extra += (xsc[i] + pv * LMUL[PREM[i]]) * WMUL[PREM[i]];
            tiles.push({ i: i, l: li, b: b });
            key += i + (b ? '*' : ':') + li + ',';
          }
        }
        if (seen[key]) return;
        seen[key] = 1;
        var score = sum * wm + extra + (tiles.length === RACK ? BINGO : 0);
        moves.push({ tiles: tiles, score: score, word: word, dir: dir });
      }
    }
    return moves;
  }

  /* ---------- Aplicar jugades */
  function rackRemove(rack, tiles) {
    for (var k = 0; k < tiles.length; k++) {
      var want = tiles[k].b ? BLANK : tiles[k].l, j = rack.indexOf(want);
      if (j < 0) return false;
      rack.splice(j, 1);
    }
    return true;
  }

  function draw(S, p) {
    while (S.racks[p].length < RACK && S.bag.length) S.racks[p].push(S.bag.pop());
  }

  function applyMove(S, tiles, score) {
    var p = S.turn, rack = S.racks[p];
    if (!rackRemove(rack, tiles)) throw new Error('fitxes que no tens');
    for (var k = 0; k < tiles.length; k++) { S.board[tiles[k].i] = tiles[k].l; S.blank[tiles[k].i] = tiles[k].b ? 1 : 0; }
    S.scores[p] += score;
    draw(S, p);
    S.scoreless = score > 0 ? 0 : S.scoreless + 1;
    S.last = { type: 'play', p: p, tiles: tiles, score: score };
    S.moves++;
    if (!rack.length && !S.bag.length) return finish(S, p);
    nextTurn(S);
  }

  function applyExchange(S, letters) {
    var p = S.turn, rack = S.racks[p];
    if (S.bag.length < RACK) throw new Error('bossa');
    var out = [];
    for (var k = 0; k < letters.length; k++) {
      var j = rack.indexOf(letters[k]);
      if (j < 0) throw new Error('fitxes que no tens');
      out.push(rack.splice(j, 1)[0]);
    }
    draw(S, p);
    // les retornades van a llocs a l'atzar de la bossa
    for (k = 0; k < out.length; k++) S.bag.splice(Math.floor(S.seed() * (S.bag.length + 1)), 0, out[k]);
    S.scoreless++;
    S.last = { type: 'swap', p: p, n: out.length };
    S.moves++;
    checkStall(S) || nextTurn(S);
  }

  function applyPass(S) {
    S.scoreless++;
    S.last = { type: 'pass', p: S.turn };
    S.moves++;
    checkStall(S) || nextTurn(S);
  }

  function nextTurn(S) { S.turn = (S.turn + 1) % S.n; }

  // 3 torns seguits sense punts per jugador (6 a 2 jugadors): s'acaba
  function checkStall(S) {
    if (S.scoreless >= 3 * S.n) { finish(S, -1); return true; }
    return false;
  }

  function rackValue(S, rack) {
    var L = prepLang(S.lang), s = 0;
    for (var k = 0; k < rack.length; k++) if (rack[k] !== BLANK) s += L.val[rack[k]];
    return s;
  }

  function finish(S, closer) {
    var bonus = 0;
    S.final = [];
    for (var p = 0; p < S.n; p++) {
      var v = rackValue(S, S.racks[p]);
      S.final.push(-v);
      S.scores[p] -= v;
      bonus += v;
    }
    if (closer >= 0) { S.scores[closer] += bonus; S.final[closer] += bonus; }
    S.over = true;
    S.closer = closer;
  }

  /* ---------- IA */
  // pesos de la heuristica (es poden ajustar des de les proves)
  var AIW = { easy: [0.4, 0.7], normal: [0.7, 0.95], cands: 12, sims: 6, opp: 0, leave: 1, blank: 7, s: 3, heavy: 3.5, mid: 1, dup: 2.5, bal: 1.2, vowDup: 1 };
  // valor de les fitxes que et quedes (heuristica senzilla)
  function leaveValue(L, rack, tiles) {
    var left = rack.slice();
    rackRemove(left, tiles);
    var v = 0, vow = 0, con = 0, seenL = {};
    for (var k = 0; k < left.length; k++) {
      var t = left[k];
      if (t === BLANK) { v += AIW.blank; continue; }
      var ch = L.alfa[t];
      if (ch === 'S') v += AIW.s;
      if (L.val[t] >= 8) v -= AIW.heavy;
      else if (L.val[t] >= 4) v -= AIW.mid;
      if (seenL[t]) v -= L.isVowel[t] ? AIW.vowDup : AIW.dup;
      seenL[t] = 1;
      if (L.isVowel[t]) vow++; else con++;
    }
    if (left.length) v -= Math.abs(vow - con) * AIW.bal;
    return v;
  }

  /* Dificil: per a les millors candidates, prova respostes del rival amb fitxes a l'atzar
     (les que no veu: bossa + faristol del rival) i resta la seva millor puntuacio mitjana. */
  function simulate(S, dict, moves, rack) {
    moves.sort(function (a, b) { return b.ev - a.ev; });
    var cands = moves.slice(0, AIW.cands), me = S.turn, opp = (me + 1) % S.n;
    var unseen = S.bag.slice();
    for (var p = 0; p < S.n; p++) if (p !== me) unseen = unseen.concat(S.racks[p]);
    var oppN = S.racks[opp].length, exact = S.bag.length === 0;
    var sims = exact ? 1 : AIW.sims, best = null;
    for (var k = 0; k < cands.length; k++) {
      var m = cands[k], T = cloneS(S), sum = 0;
      for (var j = 0; j < m.tiles.length; j++) { T.board[m.tiles[j].i] = m.tiles[j].l; T.blank[m.tiles[j].i] = m.tiles[j].b ? 1 : 0; }
      for (var s = 0; s < sims; s++) {
        var r;
        if (exact) r = S.racks[opp].slice();
        else {
          var u = unseen.slice(); r = [];
          for (j = 0; j < oppN && u.length; j++) r.push(u.splice(Math.floor(S.seed() * u.length), 1)[0]);
        }
        var om = genMoves(T, dict, r), mx = 0;
        for (j = 0; j < om.length; j++) if (om[j].score > mx) mx = om[j].score;
        sum += mx;
      }
      m.sim = m.ev - AIW.opp * sum / sims;
      if (!best || m.sim > best.sim) best = m;
    }
    return best;
  }

  function aiChoose(S, dict, level) {
    var L = prepLang(S.lang), rack = S.racks[S.turn];
    var moves = genMoves(S, dict, rack);
    if (!moves.length) {
      if (S.bag.length >= RACK) {
        // canvia les fitxes dolentes
        var bad = rack.filter(function (t) { return t !== BLANK && (L.val[t] >= 4 || L.alfa[t] === 'Q'); });
        if (!bad.length) bad = rack.slice(0, 4);
        return { type: 'swap', letters: bad };
      }
      return { type: 'pass' };
    }
    var endgame = S.bag.length === 0;
    var best;
    if (level < 2) {
      // facil: una jugada d'entre el 40% i el 70% de la millor (sense escarrassos si pot);
      // normal: d'entre el 70% i el 95%
      var noBl = level === 0 ? moves.filter(function (m) { return !m.tiles.some(function (t) { return t.b; }); }) : [];
      var pool = noBl.length ? noBl : moves, mx = 0;
      for (var q = 0; q < pool.length; q++) mx = Math.max(mx, pool[q].score);
      var f = level === 0 ? AIW.easy : AIW.normal;
      var target = mx * (f[0] + (f[1] - f[0]) * S.seed()), bd = 1e9;
      for (q = 0; q < pool.length; q++) {
        var dd = Math.abs(pool[q].score - target) + S.seed();
        if (dd < bd) { bd = dd; best = pool[q]; }
      }
    } else {
      for (var k = 0; k < moves.length; k++) {
        var m = moves[k];
        m.ev = m.score + (endgame ? 0 : AIW.leave * leaveValue(L, rack, m.tiles));
        if (!best || m.ev > best.ev) best = m;
      }
      if (AIW.opp > 0) best = simulate(S, dict, moves, rack) || best;
      // millor canviar que fer una jugada molt pobra amb mala ma
      if (level === 2 && !endgame && S.bag.length >= RACK && best.score < 8 && best.ev < 4) {
        var keep = rack.filter(function (t) { return t === BLANK || (L.val[t] <= 2 && L.alfa[t] !== 'Q'); });
        var swap = rack.slice();
        rackRemove(swap, keep.map(function (t) { return t === BLANK ? { b: 1 } : { l: t }; }));
        if (swap.length >= 3) return { type: 'swap', letters: swap };
      }
    }
    return { type: 'play', move: best };
  }

  var Motor = {
    N: N, CEN: CEN, RACK: RACK, BINGO: BINGO, BLANK: BLANK, PREM: PREM, LANGS: LANGS,
    prepLang: prepLang, letterText: letterText, encode: encode, Dict: Dict, rng: rng,
    newGame: newGame, cloneS: cloneS, evalPlacement: evalPlacement, genMoves: genMoves,
    applyMove: applyMove, applyExchange: applyExchange, applyPass: applyPass, rackValue: rackValue,
    aiChoose: aiChoose, boardEmpty: boardEmpty, AIW: AIW
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Motor;
  else root.Motor = Motor;
})(typeof window !== 'undefined' ? window : this);
