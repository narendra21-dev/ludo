// Pure Ludo engine. Runs only on the HOST phone (authoritative).
export const ROOM_CODE = "1111";
export const PORT = 8080;
export const COLORS = ["#ef4444", "#22c55e", "#eab308", "#3b82f6"];
export const COLOR_NAMES = ["Red", "Green", "Yellow", "Blue"];
export const AUTO_MOVE = true; // when only one move is possible, play it automatically
export const EMOJIS = [
  "😂",
  "😡",
  "👍",
  "😭",
  "🎉",
  "😎",
  "😮",
  "❤️",
  "🤔",
  "🔥",
];
export const QUICK_CHAT = [
  "Good luck!",
  "Well played!",
  "Hurry up!",
  "Oops!",
  "Nice move!",
  "GG",
];
export const REACTIONS = [...EMOJIS, ...QUICK_CHAT];

type XY = [number, number];

// 52 main-track squares on a 15x15 grid, clockwise. Seat s starts at index s*13.
export const TRACK: XY[] = [
  [1, 6],
  [2, 6],
  [3, 6],
  [4, 6],
  [5, 6],
  [6, 5],
  [6, 4],
  [6, 3],
  [6, 2],
  [6, 1],
  [6, 0],
  [7, 0],
  [8, 0],
  [8, 1],
  [8, 2],
  [8, 3],
  [8, 4],
  [8, 5],
  [9, 6],
  [10, 6],
  [11, 6],
  [12, 6],
  [13, 6],
  [14, 6],
  [14, 7],
  [14, 8],
  [13, 8],
  [12, 8],
  [11, 8],
  [10, 8],
  [9, 8],
  [8, 9],
  [8, 10],
  [8, 11],
  [8, 12],
  [8, 13],
  [8, 14],
  [7, 14],
  [6, 14],
  [6, 13],
  [6, 12],
  [6, 11],
  [6, 10],
  [6, 9],
  [5, 8],
  [4, 8],
  [3, 8],
  [2, 8],
  [1, 8],
  [0, 8],
  [0, 7],
  [0, 6],
];

// progress p: -1 yard | 0..50 main track | 51..55 home column | 56 home
export const HOME_COL: XY[][] = [
  [
    [1, 7],
    [2, 7],
    [3, 7],
    [4, 7],
    [5, 7],
  ],
  [
    [7, 1],
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
  ],
  [
    [13, 7],
    [12, 7],
    [11, 7],
    [10, 7],
    [9, 7],
  ],
  [
    [7, 13],
    [7, 12],
    [7, 11],
    [7, 10],
    [7, 9],
  ],
];
export const HOME_FINAL: XY[] = [
  [6, 7],
  [7, 6],
  [8, 7],
  [7, 8],
];
// Yard slots, centred inside each 4x4 white box (box = origin+1 .. origin+5, so its middle is origin+3).
// Slot centres sit at origin+2 and origin+4, i.e. top-left cell coordinate origin+1.5 and origin+3.5.
export const YARD: XY[][] = [
  [
    [1.5, 1.5],
    [3.5, 1.5],
    [1.5, 3.5],
    [3.5, 3.5],
  ], // red   (top-left)
  [
    [10.5, 1.5],
    [12.5, 1.5],
    [10.5, 3.5],
    [12.5, 3.5],
  ], // green (top-right)
  [
    [10.5, 10.5],
    [12.5, 10.5],
    [10.5, 12.5],
    [12.5, 12.5],
  ], // yellow (bottom-right)
  [
    [1.5, 10.5],
    [3.5, 10.5],
    [1.5, 12.5],
    [3.5, 12.5],
  ], // blue  (bottom-left)
];
export const SAFE = [0, 8, 13, 21, 26, 34, 39, 47];

export const posOf = (seat: number, p: number, k: number): XY => {
  if (p < 0) return YARD[seat][k];
  if (p <= 50) return TRACK[(seat * 13 + p) % 52];
  if (p <= 55) return HOME_COL[seat][p - 51];
  return HOME_FINAL[seat];
};

export type Player = {
  id: string;
  name: string;
  seat: number;
  connected: boolean;
};
export type GameState = {
  phase: "lobby" | "playing" | "finished";
  hostId: string;
  players: Player[];
  tokens: number[][]; // per player index
  turn: number;
  dice: number | null;
  movable: number[];
  sixes: number;
  winner: number | null;
  msg: string;
  rolls: number; // increments on every dice roll (used for the dice animation)
};

export const newLobby = (hostId: string): GameState => ({
  phase: "lobby",
  hostId,
  players: [],
  tokens: [],
  turn: 0,
  dice: null,
  movable: [],
  sixes: 0,
  winner: null,
  msg: "",
  rolls: 0,
});

export function addPlayer(s: GameState, id: string, name: string) {
  if (s.players.length >= 4) return false;
  s.players.push({
    id,
    name: name.slice(0, 12) || "Player",
    seat: s.players.length,
    connected: true,
  });
  return true;
}

const seatsFor = (n: number) => (n === 2 ? [0, 2] : [0, 1, 2, 3].slice(0, n));

export function startGame(s: GameState) {
  if (s.players.length < 2) return;
  const seats = seatsFor(s.players.length);
  s.players.forEach((p, i) => (p.seat = seats[i]));
  s.tokens = s.players.map(() => [-1, -1, -1, -1]);
  s.phase = "playing";
  s.turn = 0;
  s.dice = null;
  s.movable = [];
  s.sixes = 0;
  s.winner = null;
  s.msg = `${s.players[0].name} starts`;
}

export function resetToLobby(s: GameState) {
  s.players = s.players.filter((p) => p.connected);
  s.players.forEach((p, i) => (p.seat = i));
  s.phase = "lobby";
  s.tokens = [];
  s.dice = null;
  s.movable = [];
  s.winner = null;
  s.msg = "";
}

export function nextTurn(s: GameState) {
  s.sixes = 0;
  s.dice = null;
  s.movable = [];
  for (let i = 0; i < s.players.length; i++) {
    s.turn = (s.turn + 1) % s.players.length;
    if (s.players[s.turn].connected) break;
  }
  s.msg = `${s.players[s.turn].name}'s turn`;
}

export function disconnect(s: GameState, id: string) {
  const i = s.players.findIndex((p) => p.id === id);
  if (i < 0) return;
  if (s.phase === "lobby") {
    s.players.splice(i, 1);
    s.players.forEach((p, j) => (p.seat = j));
    return;
  }
  s.players[i].connected = false;
  if (s.phase === "playing") {
    const alive = s.players.filter((p) => p.connected);
    if (alive.length <= 1) {
      s.phase = "finished";
      s.winner = s.players.findIndex((p) => p.connected);
      s.msg = "Everyone else left";
    } else if (s.turn === i) nextTurn(s);
  }
}

const canMove = (p: number, d: number) =>
  p === 56 ? false : p === -1 ? d === 6 : p + d <= 56;

// returns 'wait' (player must pick a token), 'pass' (turn must end), or 'ignored'
export function roll(s: GameState, pid: string): "wait" | "pass" | "ignored" {
  const cur = s.players[s.turn];
  if (s.phase !== "playing" || !cur || cur.id !== pid || s.dice !== null)
    return "ignored";
  const d = 1 + Math.floor(Math.random() * 6);
  s.dice = d;
  s.rolls++;
  if (d === 6) s.sixes++;
  if (s.sixes >= 3) {
    s.movable = [];
    s.msg = `${cur.name} rolled three 6s - turn lost`;
    return "pass";
  }
  s.movable = s.tokens[s.turn]
    .map((p, i) => (canMove(p, d) ? i : -1))
    .filter((i) => i >= 0);
  if (!s.movable.length) {
    s.msg = `${cur.name} rolled ${d} - no move`;
    return "pass";
  }
  s.msg = `${cur.name} rolled ${d}`;
  return "wait";
}

export function move(s: GameState, pid: string, k: number) {
  const cur = s.players[s.turn];
  if (
    s.phase !== "playing" ||
    !cur ||
    cur.id !== pid ||
    s.dice === null ||
    !s.movable.includes(k)
  )
    return;
  const d = s.dice;
  const t = s.tokens[s.turn];
  const newP = t[k] === -1 ? 0 : t[k] + d;
  t[k] = newP;

  let captured = false;
  if (newP <= 50) {
    const g = (cur.seat * 13 + newP) % 52;
    if (!SAFE.includes(g)) {
      s.players.forEach((op, j) => {
        if (j === s.turn) return;
        s.tokens[j].forEach((pj, kk) => {
          if (pj >= 0 && pj <= 50 && (op.seat * 13 + pj) % 52 === g) {
            s.tokens[j][kk] = -1;
            captured = true;
          }
        });
      });
    }
  }

  if (t.every((p) => p === 56)) {
    s.phase = "finished";
    s.winner = s.turn;
    s.msg = `${cur.name} wins!`;
    s.dice = null;
    s.movable = [];
    return;
  }

  const extra = d === 6 || captured || newP === 56;
  if (extra) {
    if (d !== 6) s.sixes = 0;
    s.dice = null;
    s.movable = [];
    s.msg = captured
      ? `${cur.name} captured a token! Roll again`
      : `${cur.name} rolls again`;
  } else nextTurn(s);
}
