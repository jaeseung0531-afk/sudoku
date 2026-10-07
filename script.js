'use strict';

/* ==========================================================================
 * 1. 보드 기하 정보 (인덱스 0~80, 행 우선)
 * ========================================================================== */
const CELLS = 81;
const ALL_DIGITS = 0x3fe; // 비트 1~9

const ROW = new Array(CELLS);
const COL = new Array(CELLS);
const BOX = new Array(CELLS);
for (let i = 0; i < CELLS; i++) {
  ROW[i] = Math.floor(i / 9);
  COL[i] = i % 9;
  BOX[i] = Math.floor(ROW[i] / 3) * 3 + Math.floor(COL[i] / 3);
}

// 27개 유닛: 0~8 행, 9~17 열, 18~26 박스
const UNITS = [];
for (let r = 0; r < 9; r++) UNITS.push([...Array(9)].map((_, c) => r * 9 + c));
for (let c = 0; c < 9; c++) UNITS.push([...Array(9)].map((_, r) => r * 9 + c));
for (let b = 0; b < 9; b++) {
  const r0 = Math.floor(b / 3) * 3;
  const c0 = (b % 3) * 3;
  UNITS.push([...Array(9)].map((_, k) => (r0 + Math.floor(k / 3)) * 9 + c0 + (k % 3)));
}

const PEERS = [];
for (let i = 0; i < CELLS; i++) {
  const peers = [];
  for (let j = 0; j < CELLS; j++) {
    if (j !== i && (ROW[j] === ROW[i] || COL[j] === COL[i] || BOX[j] === BOX[i])) peers.push(j);
  }
  PEERS.push(peers);
}

function popcount(mask) {
  let n = 0;
  while (mask) { mask &= mask - 1; n++; }
  return n;
}

// 단일 비트(1 << d)를 숫자 d로 변환
function bitToDigit(bit) {
  return 31 - Math.clz32(bit);
}

function digitsOf(mask) {
  const out = [];
  for (let d = 1; d <= 9; d++) if (mask & (1 << d)) out.push(d);
  return out;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/* ==========================================================================
 * 2. 풀이 알고리즘 (비트마스크 백트래킹 + MRV)
 * ========================================================================== */

// 해의 개수를 limit개까지 센다. randomize=true면 후보 순서를 섞어 임의의 해를 만든다.
function searchSolutions(input, limit, randomize) {
  const grid = input.slice();
  const rows = new Array(9).fill(0);
  const cols = new Array(9).fill(0);
  const boxes = new Array(9).fill(0);
  for (let i = 0; i < CELLS; i++) {
    const d = grid[i];
    if (!d) continue;
    const bit = 1 << d;
    if ((rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]) & bit) return { count: 0, solution: null };
    rows[ROW[i]] |= bit;
    cols[COL[i]] |= bit;
    boxes[BOX[i]] |= bit;
  }

  let count = 0;
  let solution = null;

  function search() {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < CELLS; i++) {
      if (grid[i]) continue;
      const mask = ALL_DIGITS & ~(rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]);
      const c = popcount(mask);
      if (c < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = c;
        if (c <= 1) break;
      }
    }
    if (best === -1) {
      count++;
      if (!solution) solution = grid.slice();
      return count >= limit;
    }
    if (bestCount === 0) return false;

    const digits = digitsOf(bestMask);
    if (randomize) shuffle(digits);
    const r = ROW[best], c = COL[best], b = BOX[best];
    for (const d of digits) {
      const bit = 1 << d;
      grid[best] = d;
      rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      if (search()) return true;
      rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
    }
    grid[best] = 0;
    return false;
  }

  search();
  return { count, solution };
}

// 퍼즐의 첫 번째 해를 반환 (해가 없으면 null)
function solveSudoku(puzzle) {
  return searchSolutions(puzzle, 1, false).solution;
}

function countSolutions(puzzle, limit = 2) {
  return searchSolutions(puzzle, limit, false).count;
}

// 해가 정확히 하나인지 확인 (두 번째 해를 찾는 즉시 중단)
function hasUniqueSolution(puzzle) {
  return countSolutions(puzzle, 2) === 1;
}

// 주어진 숫자끼리 규칙 위반이 없는지 확인
function isGridConsistent(grid) {
  const rows = new Array(9).fill(0);
  const cols = new Array(9).fill(0);
  const boxes = new Array(9).fill(0);
  for (let i = 0; i < CELLS; i++) {
    const d = grid[i];
    if (!d) continue;
    if (!Number.isInteger(d) || d < 1 || d > 9) return false;
    const bit = 1 << d;
    if ((rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]) & bit) return false;
    rows[ROW[i]] |= bit; cols[COL[i]] |= bit; boxes[BOX[i]] |= bit;
  }
  return true;
}

/* ==========================================================================
 * 3. 논리 난이도 판정 (사람이 쓰는 풀이 기법으로 풀어본다)
 *    1: 네이키드/히든 싱글  2: 포인팅·클레이밍(락드 캔디데이트)
 *    3: 네이키드 페어·트리플, 히든 페어  4: X-윙  5: 위 기법으로 안 풀림
 * ========================================================================== */
function ratePuzzle(puzzle) {
  const grid = puzzle.slice();
  const cand = new Array(CELLS).fill(0);
  for (let i = 0; i < CELLS; i++) {
    if (grid[i]) continue;
    let used = 0;
    for (const p of PEERS[i]) used |= 1 << grid[p];
    cand[i] = ALL_DIGITS & ~used;
  }

  function place(i, d) {
    grid[i] = d;
    cand[i] = 0;
    const bit = 1 << d;
    for (const p of PEERS[i]) cand[p] &= ~bit;
  }

  function eliminate(cells, bit) {
    let changed = false;
    for (const i of cells) {
      if (!grid[i] && (cand[i] & bit)) { cand[i] &= ~bit; changed = true; }
    }
    return changed;
  }

  function nakedSingles() {
    let progress = false;
    for (let i = 0; i < CELLS; i++) {
      if (!grid[i] && popcount(cand[i]) === 1) { place(i, bitToDigit(cand[i])); progress = true; }
    }
    return progress;
  }

  function hiddenSingles() {
    for (const unit of UNITS) {
      for (let d = 1; d <= 9; d++) {
        const bit = 1 << d;
        let pos = -1, n = 0;
        for (const i of unit) {
          if (grid[i] === d) { n = -1; break; }
          if (!grid[i] && (cand[i] & bit)) { n++; pos = i; }
        }
        if (n === 1) { place(pos, d); return true; }
      }
    }
    return false;
  }

  function lockedCandidates() {
    // 포인팅: 박스 안의 후보가 한 행/열에만 있으면 그 행/열의 나머지에서 제거
    for (let b = 0; b < 9; b++) {
      const box = UNITS[18 + b];
      for (let d = 1; d <= 9; d++) {
        const bit = 1 << d;
        const cells = box.filter((i) => !grid[i] && (cand[i] & bit));
        if (cells.length < 2) continue;
        if (cells.every((i) => ROW[i] === ROW[cells[0]])) {
          if (eliminate(UNITS[ROW[cells[0]]].filter((i) => BOX[i] !== b), bit)) return true;
        }
        if (cells.every((i) => COL[i] === COL[cells[0]])) {
          if (eliminate(UNITS[9 + COL[cells[0]]].filter((i) => BOX[i] !== b), bit)) return true;
        }
      }
    }
    // 클레이밍: 행/열 안의 후보가 한 박스에만 있으면 그 박스의 나머지에서 제거
    for (let u = 0; u < 18; u++) {
      const line = UNITS[u];
      for (let d = 1; d <= 9; d++) {
        const bit = 1 << d;
        const cells = line.filter((i) => !grid[i] && (cand[i] & bit));
        if (cells.length < 2) continue;
        const b = BOX[cells[0]];
        if (cells.every((i) => BOX[i] === b)) {
          const lineSet = new Set(line);
          if (eliminate(UNITS[18 + b].filter((i) => !lineSet.has(i)), bit)) return true;
        }
      }
    }
    return false;
  }

  function subsets() {
    for (const unit of UNITS) {
      const empties = unit.filter((i) => !grid[i]);
      // 네이키드 페어/트리플
      for (let a = 0; a < empties.length; a++) {
        for (let b = a + 1; b < empties.length; b++) {
          const pairMask = cand[empties[a]] | cand[empties[b]];
          if (popcount(pairMask) === 2) {
            const others = empties.filter((i) => i !== empties[a] && i !== empties[b]);
            let changed = false;
            for (const d of digitsOf(pairMask)) changed = eliminate(others, 1 << d) || changed;
            if (changed) return true;
          }
          for (let c = b + 1; c < empties.length; c++) {
            const triMask = pairMask | cand[empties[c]];
            if (popcount(triMask) !== 3) continue;
            const others = empties.filter((i) => i !== empties[a] && i !== empties[b] && i !== empties[c]);
            let changed = false;
            for (const d of digitsOf(triMask)) changed = eliminate(others, 1 << d) || changed;
            if (changed) return true;
          }
        }
      }
      // 히든 페어
      const positions = {};
      for (let d = 1; d <= 9; d++) positions[d] = empties.filter((i) => cand[i] & (1 << d));
      for (let d1 = 1; d1 <= 9; d1++) {
        if (positions[d1].length !== 2) continue;
        for (let d2 = d1 + 1; d2 <= 9; d2++) {
          const p1 = positions[d1], p2 = positions[d2];
          if (p2.length !== 2 || p1[0] !== p2[0] || p1[1] !== p2[1]) continue;
          const keep = (1 << d1) | (1 << d2);
          let changed = false;
          for (const i of p1) {
            if (cand[i] & ~keep) { cand[i] &= keep; changed = true; }
          }
          if (changed) return true;
        }
      }
    }
    return false;
  }

  function xWing() {
    for (let d = 1; d <= 9; d++) {
      const bit = 1 << d;
      for (const byRow of [true, false]) {
        const lines = [];
        for (let k = 0; k < 9; k++) {
          const unit = UNITS[byRow ? k : 9 + k];
          let mask = 0;
          for (const i of unit) if (!grid[i] && (cand[i] & bit)) mask |= 1 << (byRow ? COL[i] : ROW[i]);
          if (popcount(mask) === 2) lines.push({ k, mask });
        }
        for (let a = 0; a < lines.length; a++) {
          for (let b = a + 1; b < lines.length; b++) {
            if (lines[a].mask !== lines[b].mask) continue;
            let changed = false;
            for (let x = 0; x < 9; x++) {
              if (!(lines[a].mask & (1 << x))) continue;
              const cross = UNITS[byRow ? 9 + x : x];
              const targets = cross.filter((i) => {
                const k = byRow ? ROW[i] : COL[i];
                return k !== lines[a].k && k !== lines[b].k;
              });
              changed = eliminate(targets, bit) || changed;
            }
            if (changed) return true;
          }
        }
      }
    }
    return false;
  }

  const steps = [
    [nakedSingles, 1],
    [hiddenSingles, 1],
    [lockedCandidates, 2],
    [subsets, 3],
    [xWing, 4],
  ];

  let level = 1;
  for (let guard = 0; guard < 2000; guard++) {
    if (grid.every((v) => v)) return { level, solved: true };
    let progressed = false;
    for (const [technique, techLevel] of steps) {
      if (technique()) {
        level = Math.max(level, techLevel);
        progressed = true;
        break;
      }
    }
    if (!progressed) return { level: 5, solved: false };
  }
  return { level: 5, solved: false };
}

/* ==========================================================================
 * 4. 퍼즐 생성
 * ========================================================================== */
const DIFFICULTIES = {
  easy:   { label: '쉬움',        targetClues: 38, maxLevel: 1, minLevel: 1, desc: '싱글 기법만으로 풀림' },
  medium: { label: '보통',        targetClues: 32, maxLevel: 2, minLevel: 2, desc: '포인팅·클레이밍 필요' },
  hard:   { label: '어려움',      targetClues: 27, maxLevel: 4, minLevel: 3, desc: '페어·트리플·X-윙 필요' },
  expert: { label: '매우 어려움', targetClues: 23, maxLevel: 5, minLevel: 4, desc: '고급 기법·깊은 추론 필요' },
};
const DIFFICULTY_KEYS = Object.keys(DIFFICULTIES);

const GENERATION_LIMITS = { maxAttempts: 1500, timeBudgetMs: 2500, maxValidationRetries: 10 };

// 완성된 9x9 정답판을 무작위로 생성
function generateSudoku() {
  return searchSolutions(new Array(CELLS).fill(0), 1, true).solution;
}

function countClues(puzzle) {
  return puzzle.reduce((n, v) => n + (v ? 1 : 0), 0);
}

// 정답판에서 숫자를 지워 퍼즐을 만든다. 지울 때마다 유일해·최대 난이도를 확인한다.
function carvePuzzle(solution, cfg) {
  const puzzle = solution.slice();
  let clues = CELLS;

  function tryRemove(cells) {
    const backup = cells.map((i) => puzzle[i]);
    for (const i of cells) puzzle[i] = 0;
    const ok = hasUniqueSolution(puzzle) && (cfg.maxLevel >= 5 || ratePuzzle(puzzle).level <= cfg.maxLevel);
    if (ok) {
      clues -= cells.length;
      return true;
    }
    cells.forEach((i, k) => { puzzle[i] = backup[k]; });
    return false;
  }

  // 1차: 중앙 대칭으로 두 칸씩 제거 (보기 좋은 배치)
  for (const i of shuffle([...Array(41).keys()])) {
    if (clues <= cfg.targetClues) break;
    const pair = i === 40 ? [40] : [i, 80 - i];
    if (pair.every((k) => puzzle[k])) tryRemove(pair);
  }
  // 2차: 목표 개수까지 한 칸씩 추가 제거
  for (const i of shuffle([...Array(CELLS).keys()])) {
    if (clues <= cfg.targetClues) break;
    if (puzzle[i]) tryRemove([i]);
  }
  return puzzle;
}

// 난이도 조건(논리 기법 수준)을 만족하는 퍼즐을 생성. 시도 횟수와 시간에 상한을 둬 무한 루프를 막는다.
function generatePuzzle(difficulty) {
  const cfg = DIFFICULTIES[difficulty] || DIFFICULTIES.medium;
  const deadline = now() + GENERATION_LIMITS.timeBudgetMs;
  let best = null;

  for (let attempt = 0; attempt < GENERATION_LIMITS.maxAttempts; attempt++) {
    const solution = generateSudoku();
    const puzzle = carvePuzzle(solution, cfg);
    const { level } = ratePuzzle(puzzle);
    const candidate = { puzzle, solution, level, clues: countClues(puzzle), attempts: attempt + 1 };

    if (level >= cfg.minLevel && level <= cfg.maxLevel) return candidate;
    if (!best || isBetterCandidate(candidate, best, cfg)) best = candidate;
    if (now() > deadline) break;
  }
  return best;
}

function isBetterCandidate(a, b, cfg) {
  const aOk = a.level <= cfg.maxLevel;
  const bOk = b.level <= cfg.maxLevel;
  if (aOk !== bOk) return aOk;
  if (a.level !== b.level) return a.level > b.level;
  return a.clues < b.clues;
}

// 생성된 퍼즐 검증: 규칙 위반 · 해 존재 · 해 유일성 · 정답 일치
function validatePuzzle(puzzle, solution) {
  if (!Array.isArray(puzzle) || !Array.isArray(solution)) return { ok: false, reason: '배열 아님' };
  if (puzzle.length !== CELLS || solution.length !== CELLS) return { ok: false, reason: '길이 오류' };
  if (!isGridConsistent(puzzle)) return { ok: false, reason: '주어진 숫자가 규칙 위반' };
  if (solution.some((v) => !v) || !isGridConsistent(solution)) return { ok: false, reason: '정답판 오류' };
  if (puzzle.some((v, i) => v && v !== solution[i])) return { ok: false, reason: '정답과 불일치' };
  const { count, solution: solved } = searchSolutions(puzzle, 2, false);
  if (count === 0) return { ok: false, reason: '해 없음' };
  if (count > 1) return { ok: false, reason: '해가 여러 개' };
  if (solved.some((v, i) => v !== solution[i])) return { ok: false, reason: '풀이 결과와 정답 불일치' };
  return { ok: true };
}

// 검증을 통과한 퍼즐만 반환. 실패한 퍼즐은 버리고 다시 생성한다.
function createVerifiedPuzzle(difficulty) {
  for (let i = 0; i < GENERATION_LIMITS.maxValidationRetries; i++) {
    const result = generatePuzzle(difficulty);
    if (result && validatePuzzle(result.puzzle, result.solution).ok) return result;
  }
  throw new Error('퍼즐 생성에 실패했습니다.');
}

/* ==========================================================================
 * 5. 게임 상태 · 규칙 판정
 * ========================================================================== */
const STORAGE_KEYS = {
  game: 'sudoku.v1.game',
  stats: 'sudoku.v1.stats',
  theme: 'sudoku.v1.theme',
};

let state = null;
let timerId = null;
let pendingCellFlash = null;

function createGameState(difficulty, puzzle, solution) {
  return {
    difficulty,
    puzzle: puzzle.slice(),
    solution: solution.slice(),
    board: puzzle.slice(),
    notes: new Array(CELLS).fill(0),
    hinted: [],
    history: [],
    selected: -1,
    elapsed: 0,
    hints: 0,
    mistakes: 0,
    notesMode: false,
    completed: false,
    startedAt: Date.now(),
  };
}

function isGiven(i) {
  return state.puzzle[i] !== 0;
}

function isLocked(i) {
  return isGiven(i) || state.hinted.includes(i);
}

// 숫자 d를 칸 i에 넣었을 때 규칙 충돌 칸과 정답 여부를 반환
function checkMove(board, solution, i, d) {
  const conflicts = PEERS[i].filter((p) => board[p] === d);
  return { conflicts, correct: solution[i] === d };
}

// 현재 판에서 규칙을 위반하는 칸 전체
function findConflicts(board) {
  const bad = new Set();
  for (let i = 0; i < CELLS; i++) {
    const d = board[i];
    if (!d) continue;
    for (const p of PEERS[i]) {
      if (board[p] === d) { bad.add(i); bad.add(p); }
    }
  }
  return bad;
}

function pushHistory() {
  state.history.push({ board: state.board.slice(), notes: state.notes.slice(), hinted: state.hinted.slice() });
  if (state.history.length > 200) state.history.shift();
}

// 정답 숫자를 넣으면 같은 행·열·박스 메모에서 해당 숫자를 지운다
function clearPeerNotes(i, d) {
  const bit = 1 << d;
  for (const p of PEERS[i]) state.notes[p] &= ~bit;
}

function placeNumber(d) {
  if (!state || state.completed) return;
  const i = state.selected;
  if (i < 0) return;
  if (isLocked(i)) { flashCell(i, 'shake'); return; }

  if (state.notesMode) {
    if (state.board[i]) { flashCell(i, 'shake'); return; }
    toggleNote(i, d);
    return;
  }
  if (state.board[i] === d) return;

  pushHistory();
  state.board[i] = d;
  state.notes[i] = 0;
  const { correct } = checkMove(state.board, state.solution, i, d);
  if (correct) {
    clearPeerNotes(i, d);
  } else {
    state.mistakes++;
    pendingCellFlash = { i, cls: 'shake' };
  }
  afterChange();
  checkCompletion();
}

function removeNumber() {
  if (!state || state.completed) return;
  const i = state.selected;
  if (i < 0) return;
  if (isLocked(i)) { flashCell(i, 'shake'); return; }
  if (!state.board[i] && !state.notes[i]) return;
  pushHistory();
  state.board[i] = 0;
  state.notes[i] = 0;
  afterChange();
}

function toggleNote(i, d) {
  pushHistory();
  state.notes[i] ^= 1 << d;
  afterChange();
}

// 메모 모드 켜기/끄기
function toggleNotes() {
  if (!state) return;
  state.notesMode = !state.notesMode;
  saveGame();
  render();
}

function undoMove() {
  if (!state || state.completed || !state.history.length) return;
  const prev = state.history.pop();
  state.board = prev.board;
  state.notes = prev.notes;
  state.hinted = prev.hinted;
  afterChange();
}

// 선택한 칸(없거나 이미 맞으면 무작위 빈 칸)에 정답을 채운다
function giveHint() {
  if (!state || state.completed) return;
  let i = state.selected;
  if (i < 0 || isLocked(i) || state.board[i] === state.solution[i]) {
    const open = [];
    for (let k = 0; k < CELLS; k++) if (state.board[k] !== state.solution[k]) open.push(k);
    if (!open.length) return;
    i = open[Math.floor(Math.random() * open.length)];
  }
  pushHistory();
  const d = state.solution[i];
  state.board[i] = d;
  state.notes[i] = 0;
  state.hinted.push(i);
  state.hints++;
  state.selected = i;
  clearPeerNotes(i, d);
  addHintToStatistics(state.difficulty);
  pendingCellFlash = { i, cls: 'pop' };
  afterChange();
  checkCompletion();
}

function checkCompletion() {
  if (!state || state.completed) return false;
  if (!state.board.every((v, i) => v === state.solution[i])) return false;
  state.completed = true;
  state.history = [];
  stopTimer();
  const isRecord = recordGameCompleted(state.difficulty, state.elapsed, state.hints, state.mistakes);
  saveGame();
  render();
  setTimeout(() => showCompleteModal(isRecord), 350);
  return true;
}

function afterChange() {
  saveGame();
  render();
}

/* ==========================================================================
 * 6. 저장 (localStorage)
 * ========================================================================== */
function storageGet(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch (e) {
    return null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* 저장 공간이 없거나 비공개 모드면 저장만 건너뛴다 */
  }
}

function saveGame() {
  if (!state) return;
  storageSet(STORAGE_KEYS.game, state);
}

// 저장된 게임을 읽고 형식·퍼즐 유효성을 확인한 뒤 반환
function loadGame() {
  const saved = storageGet(STORAGE_KEYS.game);
  if (!saved || typeof saved !== 'object') return null;
  const arrays = ['puzzle', 'solution', 'board', 'notes'];
  if (arrays.some((k) => !Array.isArray(saved[k]) || saved[k].length !== CELLS)) return null;
  if (!DIFFICULTIES[saved.difficulty]) return null;
  if (!validatePuzzle(saved.puzzle, saved.solution).ok) return null;
  if (saved.puzzle.some((v, i) => v && saved.board[i] !== v)) return null;
  return {
    ...createGameState(saved.difficulty, saved.puzzle, saved.solution),
    board: saved.board.map((v) => (Number.isInteger(v) && v >= 0 && v <= 9 ? v : 0)),
    notes: saved.notes.map((v) => (Number.isInteger(v) ? v & ALL_DIGITS : 0)),
    hinted: Array.isArray(saved.hinted) ? saved.hinted.filter((i) => Number.isInteger(i)) : [],
    selected: Number.isInteger(saved.selected) && saved.selected >= -1 && saved.selected < CELLS ? saved.selected : -1,
    elapsed: Number(saved.elapsed) > 0 ? Math.floor(saved.elapsed) : 0,
    hints: Number(saved.hints) > 0 ? Math.floor(saved.hints) : 0,
    mistakes: Number(saved.mistakes) > 0 ? Math.floor(saved.mistakes) : 0,
    notesMode: !!saved.notesMode,
    completed: !!saved.completed,
    startedAt: saved.startedAt || Date.now(),
  };
}

/* ==========================================================================
 * 7. 통계 · 최고 기록
 * ========================================================================== */
function emptyStats() {
  const perDifficulty = {};
  for (const key of DIFFICULTY_KEYS) {
    perDifficulty[key] = { played: 0, completed: 0, totalTime: 0, bestTime: null, hints: 0 };
  }
  return { perDifficulty, records: [] };
}

function loadStatistics() {
  const saved = storageGet(STORAGE_KEYS.stats);
  const stats = emptyStats();
  if (!saved || typeof saved !== 'object') return stats;
  for (const key of DIFFICULTY_KEYS) {
    const s = saved.perDifficulty && saved.perDifficulty[key];
    if (!s) continue;
    stats.perDifficulty[key] = {
      played: Number(s.played) || 0,
      completed: Number(s.completed) || 0,
      totalTime: Number(s.totalTime) || 0,
      bestTime: Number.isFinite(s.bestTime) ? s.bestTime : null,
      hints: Number(s.hints) || 0,
    };
  }
  if (Array.isArray(saved.records)) stats.records = saved.records.slice(0, 50);
  return stats;
}

function saveStatistics(stats) {
  storageSet(STORAGE_KEYS.stats, stats);
}

function recordGameStarted(difficulty) {
  const stats = loadStatistics();
  stats.perDifficulty[difficulty].played++;
  saveStatistics(stats);
}

function addHintToStatistics(difficulty) {
  const stats = loadStatistics();
  stats.perDifficulty[difficulty].hints++;
  saveStatistics(stats);
}

// 완료 기록 저장. 최고 기록을 갱신하면 true
function recordGameCompleted(difficulty, seconds, hints, mistakes) {
  const stats = loadStatistics();
  const s = stats.perDifficulty[difficulty];
  s.completed++;
  s.totalTime += seconds;
  const isRecord = s.bestTime === null || seconds < s.bestTime;
  if (isRecord) s.bestTime = seconds;
  stats.records.unshift({ difficulty, seconds, hints, mistakes, date: new Date().toISOString() });
  stats.records = stats.records.slice(0, 50);
  saveStatistics(stats);
  return isRecord;
}

function summarize(list) {
  const played = list.reduce((n, s) => n + s.played, 0);
  const completed = list.reduce((n, s) => n + s.completed, 0);
  const totalTime = list.reduce((n, s) => n + s.totalTime, 0);
  const hints = list.reduce((n, s) => n + s.hints, 0);
  const bests = list.map((s) => s.bestTime).filter((v) => v !== null);
  return {
    played,
    completed,
    winRate: played ? Math.round((completed / played) * 100) : 0,
    avgTime: completed ? Math.round(totalTime / completed) : null,
    bestTime: bests.length ? Math.min(...bests) : null,
    hints,
  };
}

function formatTime(seconds) {
  if (seconds === null || seconds === undefined) return '--:--';
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/* ==========================================================================
 * 8. 타이머
 * ========================================================================== */
function startTimer() {
  stopTimer();
  timerId = setInterval(tick, 1000);
}

function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}

// 탭이 숨겨져 있거나 모달이 열려 있으면 시간을 세지 않는다
function tick() {
  if (!state || state.completed || document.hidden || isModalOpen()) return;
  state.elapsed++;
  renderTimer();
  saveGame();
}

/* ==========================================================================
 * 9. 화면 렌더링
 * ========================================================================== */
const els = {};
const cellEls = [];

function buildBoard() {
  els.board.innerHTML = '';
  for (let i = 0; i < CELLS; i++) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    if (COL[i] % 3 === 2 && COL[i] !== 8) cell.classList.add('edge-right');
    if (ROW[i] % 3 === 2 && ROW[i] !== 8) cell.classList.add('edge-bottom');
    cell.dataset.index = i;
    cell.setAttribute('role', 'gridcell');

    const value = document.createElement('span');
    value.className = 'value';
    const notes = document.createElement('span');
    notes.className = 'notes';
    for (let d = 1; d <= 9; d++) {
      const n = document.createElement('span');
      n.dataset.digit = d;
      notes.appendChild(n);
    }
    cell.append(value, notes);
    els.board.appendChild(cell);
    cellEls.push({ cell, value, notes: [...notes.children] });
  }
}

function buildPad() {
  els.pad.innerHTML = '';
  for (let d = 1; d <= 9; d++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'num-btn';
    btn.dataset.digit = d;
    btn.innerHTML = `<span class="num">${d}</span><span class="left"></span>`;
    els.pad.appendChild(btn);
  }
}

function render() {
  if (!state) return;
  renderBoard();
  renderPad();
  renderInfo();
  renderTimer();
}

function renderBoard() {
  const sel = state.selected;
  const selValue = sel >= 0 ? state.board[sel] : 0;
  const conflicts = findConflicts(state.board);

  for (let i = 0; i < CELLS; i++) {
    const { cell, value, notes } = cellEls[i];
    const d = state.board[i];
    const given = isGiven(i);
    const related = sel >= 0 && i !== sel && (ROW[i] === ROW[sel] || COL[i] === COL[sel] || BOX[i] === BOX[sel]);

    cell.classList.toggle('given', given);
    cell.classList.toggle('user', !given && !!d);
    cell.classList.toggle('hinted', state.hinted.includes(i));
    cell.classList.toggle('selected', i === sel);
    cell.classList.toggle('related', related);
    cell.classList.toggle('same', !!selValue && d === selValue && i !== sel);
    cell.classList.toggle('conflict', conflicts.has(i));
    cell.classList.toggle('wrong', !given && !!d && d !== state.solution[i]);
    cell.classList.toggle('solved', state.completed);

    value.textContent = d ? d : '';
    const hasNotes = !d && state.notes[i];
    cell.classList.toggle('has-notes', !!hasNotes);
    for (let k = 0; k < 9; k++) {
      const digit = k + 1;
      const on = hasNotes && (state.notes[i] & (1 << digit));
      notes[k].textContent = on ? digit : '';
      notes[k].classList.toggle('match', !!on && digit === selValue);
    }
    const label = `${ROW[i] + 1}행 ${COL[i] + 1}열 ${d ? d : '빈 칸'}`;
    cell.setAttribute('aria-label', label);
  }

  if (pendingCellFlash) {
    const { i, cls } = pendingCellFlash;
    pendingCellFlash = null;
    flashCell(i, cls);
  }
}

function renderPad() {
  const counts = new Array(10).fill(0);
  for (let i = 0; i < CELLS; i++) {
    if (state.board[i] && state.board[i] === state.solution[i]) counts[state.board[i]]++;
  }
  const selValue = state.selected >= 0 ? state.board[state.selected] : 0;
  for (const btn of els.pad.children) {
    const d = Number(btn.dataset.digit);
    const left = 9 - counts[d];
    btn.querySelector('.left').textContent = left > 0 ? left : '';
    btn.classList.toggle('done', left <= 0);
    btn.classList.toggle('active', d === selValue);
    btn.disabled = state.completed || (left <= 0 && !state.notesMode);
  }
  els.pad.classList.toggle('notes-mode', state.notesMode);
}

function renderInfo() {
  els.difficulty.textContent = DIFFICULTIES[state.difficulty].label;
  els.hintCount.textContent = state.hints;
  els.mistakeCount.textContent = state.mistakes;
  els.notesBtn.classList.toggle('on', state.notesMode);
  els.notesBtn.setAttribute('aria-pressed', String(state.notesMode));
  els.notesState.textContent = state.notesMode ? 'ON' : 'OFF';
  els.undoBtn.disabled = state.completed || !state.history.length;
  els.hintBtn.disabled = state.completed;
  els.eraseBtn.disabled = state.completed;
}

function renderTimer() {
  els.timer.textContent = formatTime(state ? state.elapsed : 0);
}

function flashCell(i, cls) {
  const cell = cellEls[i] && cellEls[i].cell;
  if (!cell) return;
  cell.classList.remove(cls);
  void cell.offsetWidth; // 애니메이션 재시작
  cell.classList.add(cls);
  setTimeout(() => cell.classList.remove(cls), 450);
}

function selectCell(i) {
  if (!state) return;
  state.selected = i;
  saveGame();
  render();
}

function moveSelection(dRow, dCol) {
  if (!state) return;
  const sel = state.selected < 0 ? 40 : state.selected;
  const r = (ROW[sel] + dRow + 9) % 9;
  const c = (COL[sel] + dCol + 9) % 9;
  selectCell(state.selected < 0 ? 40 : r * 9 + c);
}

/* ==========================================================================
 * 10. 모달 (난이도 선택 · 완료 · 통계)
 * ========================================================================== */
function isModalOpen() {
  return !!document.querySelector('.modal.open');
}

function openModal(id) {
  document.querySelectorAll('.modal.open').forEach((m) => m.classList.remove('open'));
  const modal = document.getElementById(id);
  modal.classList.add('open');
  const focusTarget = modal.querySelector('[data-autofocus]') || modal.querySelector('button');
  if (focusTarget) setTimeout(() => focusTarget.focus(), 30);
}

function closeModal() {
  document.querySelectorAll('.modal.open').forEach((m) => m.classList.remove('open'));
}

function showDifficultyModal() {
  const stats = loadStatistics();
  const canCancel = !!state && !state.completed;
  els.diffCancel.hidden = !canCancel;
  els.diffList.innerHTML = '';
  for (const key of DIFFICULTY_KEYS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'diff-option';
    btn.dataset.difficulty = key;
    if (state && state.difficulty === key) {
      btn.classList.add('current');
      btn.setAttribute('data-autofocus', '');
    }
    const best = stats.perDifficulty[key].bestTime;
    btn.innerHTML = `<span class="diff-name">${DIFFICULTIES[key].label}</span>
      <span class="diff-meta">${DIFFICULTIES[key].desc} · 빈칸 약 ${CELLS - DIFFICULTIES[key].targetClues}개</span>
      <span class="diff-best">최고 기록 ${formatTime(best)}</span>`;
    els.diffList.appendChild(btn);
  }
  els.diffNote.hidden = !canCancel;
  openModal('difficulty-modal');
}

function showCompleteModal(isRecord) {
  els.doneTime.textContent = formatTime(state.elapsed);
  els.doneHints.textContent = `${state.hints}회`;
  els.doneMistakes.textContent = `${state.mistakes}회`;
  els.doneDifficulty.textContent = DIFFICULTIES[state.difficulty].label;
  const best = loadStatistics().perDifficulty[state.difficulty].bestTime;
  els.doneBest.textContent = formatTime(best);
  els.recordBadge.hidden = !isRecord;
  openModal('complete-modal');
}

function showStatsModal() {
  const stats = loadStatistics();
  const columns = [{ key: 'all', label: '전체', s: summarize(Object.values(stats.perDifficulty)) }]
    .concat(DIFFICULTY_KEYS.map((key) => ({ key, label: DIFFICULTIES[key].label, s: summarize([stats.perDifficulty[key]]) })));

  const rows = [
    ['플레이', (s) => `${s.played}`],
    ['완료', (s) => `${s.completed}`],
    ['승률', (s) => `${s.winRate}%`],
    ['평균 시간', (s) => formatTime(s.avgTime)],
    ['최고 기록', (s) => formatTime(s.bestTime)],
    ['힌트 사용', (s) => `${s.hints}`],
  ];

  const total = columns[0].s;
  els.statsSummary.innerHTML = [
    ['플레이', total.played],
    ['완료', total.completed],
    ['승률', `${total.winRate}%`],
    ['평균', formatTime(total.avgTime)],
  ].map(([k, v]) => `<div class="stat-card"><span class="stat-value">${v}</span><span class="stat-label">${k}</span></div>`).join('');

  let html = '<table><thead><tr><th></th>';
  for (const c of columns.slice(1)) html += `<th>${c.label}</th>`;
  html += '</tr></thead><tbody>';
  for (const [label, fn] of rows) {
    html += `<tr><th>${label}</th>`;
    for (const c of columns.slice(1)) html += `<td>${fn(c.s)}</td>`;
    html += '</tr>';
  }
  html += '</tbody></table>';
  els.statsTable.innerHTML = html;

  if (stats.records.length) {
    els.statsRecords.innerHTML = stats.records.slice(0, 8).map((r) => {
      const date = new Date(r.date);
      const day = isNaN(date) ? '' : `${date.getMonth() + 1}/${date.getDate()}`;
      const label = DIFFICULTIES[r.difficulty] ? DIFFICULTIES[r.difficulty].label : r.difficulty;
      return `<li><span>${day} · ${label}</span><span>${formatTime(r.seconds)} · 힌트 ${r.hints}</span></li>`;
    }).join('');
  } else {
    els.statsRecords.innerHTML = '<li class="empty">아직 완료한 게임이 없습니다.</li>';
  }
  openModal('stats-modal');
}

/* ==========================================================================
 * 11. 게임 시작 · 재시작
 * ========================================================================== */
function startNewGame(difficulty) {
  closeModal();
  stopTimer();
  els.loading.classList.add('show');
  // 로딩 표시가 먼저 그려지도록 한 프레임 뒤에 생성
  setTimeout(() => {
    try {
      const { puzzle, solution } = createVerifiedPuzzle(difficulty);
      state = createGameState(difficulty, puzzle, solution);
      recordGameStarted(difficulty);
      saveGame();
      render();
      startTimer();
    } catch (e) {
      console.error(e);
      alert('퍼즐을 만드는 중 문제가 생겼습니다. 다시 시도해 주세요.');
    } finally {
      els.loading.classList.remove('show');
    }
  }, 40);
}

// 같은 퍼즐을 처음부터 다시
function restartGame() {
  if (!state) return;
  const { difficulty, puzzle, solution } = state;
  closeModal();
  state = createGameState(difficulty, puzzle, solution);
  recordGameStarted(difficulty);
  saveGame();
  render();
  startTimer();
}

/* ==========================================================================
 * 12. 테마
 * ========================================================================== */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  els.themeBtn.setAttribute('aria-label', theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#111827' : '#f5f7fb');
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  storageSet(STORAGE_KEYS.theme, next);
}

function loadTheme() {
  const saved = storageGet(STORAGE_KEYS.theme);
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/* ==========================================================================
 * 13. 입력 처리 (마우스 · 터치 · 키보드)
 * ========================================================================== */
function handleKeydown(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  if (isModalOpen()) {
    if (e.key === 'Escape') {
      const open = document.querySelector('.modal.open');
      if (open.id !== 'difficulty-modal' || !els.diffCancel.hidden) closeModal();
    }
    return;
  }
  if (!state) return;

  const key = e.key;
  if (/^[1-9]$/.test(key)) {
    placeNumber(Number(key));
  } else if (key === 'Backspace' || key === 'Delete' || key === '0') {
    removeNumber();
  } else if (key === 'ArrowUp') {
    moveSelection(-1, 0);
  } else if (key === 'ArrowDown') {
    moveSelection(1, 0);
  } else if (key === 'ArrowLeft') {
    moveSelection(0, -1);
  } else if (key === 'ArrowRight') {
    moveSelection(0, 1);
  } else if (key === 'm' || key === 'M') {
    toggleNotes();
  } else if (key === 'h' || key === 'H') {
    giveHint();
  } else if (key === 'n' || key === 'N') {
    showDifficultyModal();
  } else if (key === 'u' || key === 'U') {
    undoMove();
  } else if (key === 'Escape') {
    selectCell(-1);
  } else {
    return;
  }
  e.preventDefault();
}

function bindEvents() {
  els.board.addEventListener('click', (e) => {
    const cell = e.target.closest('.cell');
    if (cell) selectCell(Number(cell.dataset.index));
  });
  els.pad.addEventListener('click', (e) => {
    const btn = e.target.closest('.num-btn');
    if (btn && !btn.disabled) placeNumber(Number(btn.dataset.digit));
  });
  els.eraseBtn.addEventListener('click', removeNumber);
  els.notesBtn.addEventListener('click', toggleNotes);
  els.hintBtn.addEventListener('click', giveHint);
  els.undoBtn.addEventListener('click', undoMove);
  els.newBtn.addEventListener('click', showDifficultyModal);
  els.diffChip.addEventListener('click', showDifficultyModal);
  els.themeBtn.addEventListener('click', toggleTheme);
  els.statsBtn.addEventListener('click', showStatsModal);

  els.diffList.addEventListener('click', (e) => {
    const btn = e.target.closest('.diff-option');
    if (btn) startNewGame(btn.dataset.difficulty);
  });
  els.diffCancel.addEventListener('click', closeModal);
  els.replayBtn.addEventListener('click', restartGame);
  els.sameDiffBtn.addEventListener('click', () => startNewGame(state.difficulty));
  els.changeDiffBtn.addEventListener('click', showDifficultyModal);
  els.statsClose.addEventListener('click', closeModal);

  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target !== modal) return;
      if (modal.id === 'stats-modal') closeModal();
    });
  });

  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
  window.addEventListener('beforeunload', saveGame);
}

function cacheElements() {
  const byId = (id) => document.getElementById(id);
  Object.assign(els, {
    board: byId('board'),
    pad: byId('number-pad'),
    timer: byId('timer'),
    difficulty: byId('difficulty-label'),
    diffChip: byId('difficulty-chip'),
    hintCount: byId('hint-count'),
    mistakeCount: byId('mistake-count'),
    eraseBtn: byId('erase-btn'),
    notesBtn: byId('notes-btn'),
    notesState: byId('notes-state'),
    hintBtn: byId('hint-btn'),
    undoBtn: byId('undo-btn'),
    newBtn: byId('new-btn'),
    themeBtn: byId('theme-btn'),
    statsBtn: byId('stats-btn'),
    loading: byId('loading'),
    diffList: byId('difficulty-list'),
    diffCancel: byId('difficulty-cancel'),
    diffNote: byId('difficulty-note'),
    doneTime: byId('done-time'),
    doneHints: byId('done-hints'),
    doneMistakes: byId('done-mistakes'),
    doneDifficulty: byId('done-difficulty'),
    doneBest: byId('done-best'),
    recordBadge: byId('record-badge'),
    replayBtn: byId('replay-btn'),
    sameDiffBtn: byId('same-diff-btn'),
    changeDiffBtn: byId('change-diff-btn'),
    statsSummary: byId('stats-summary'),
    statsTable: byId('stats-table'),
    statsRecords: byId('stats-records'),
    statsClose: byId('stats-close'),
  });
}

/* ==========================================================================
 * 14. 앱 설치 (PWA) · 오프라인
 * ========================================================================== */
let deferredInstallPrompt = null;

function setupInstall() {
  // 서비스 워커는 http(s)에서만 동작 (파일로 직접 연 경우는 건너뜀)
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('서비스 워커 등록 실패', e));
  }
  const installBtn = document.getElementById('install-btn');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installBtn.hidden = true;
  });
  window.addEventListener('appinstalled', () => { installBtn.hidden = true; });
}

function init() {
  setupInstall();
  cacheElements();
  applyTheme(loadTheme());
  buildBoard();
  buildPad();
  bindEvents();

  const saved = loadGame();
  if (saved && !saved.completed) {
    state = saved;
    render();
    startTimer();
  } else {
    if (saved) state = saved;
    if (state) render();
    showDifficultyModal();
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
}

// Node 환경 테스트용 내보내기 (브라우저에서는 무시됨)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateSudoku, solveSudoku, countSolutions, hasUniqueSolution, isGridConsistent,
    ratePuzzle, carvePuzzle, generatePuzzle, validatePuzzle, createVerifiedPuzzle,
    checkMove, findConflicts, formatTime, summarize, DIFFICULTIES, PEERS, UNITS,
  };
}
