// Fully offline networking: raw TCP over the local hotspot/Wi-Fi (no internet needed).
// Host phone runs the TCP server + game engine. Others are thin clients.
import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import TcpSocket from "react-native-tcp-socket";
import * as Network from "expo-network";
import {
  AUTO_MOVE,
  REACTIONS,
  GameState,
  PORT,
  ROOM_CODE,
  addPlayer,
  disconnect,
  move,
  newLobby,
  nextTurn,
  resetToLobby,
  roll,
  startGame,
} from "./ludo";

type Role = "host" | "client" | null;
export type Reaction = { key: string; from: string; e: string };

type Ctx = {
  role: Role;
  state: GameState | null;
  myId: string | null;
  error: string | null;
  busy: boolean;
  hostIp: string | null;
  reactions: Reaction[];
  hostGame: (name: string) => Promise<void>;
  joinGame: (ip: string, name: string, code: string) => void;
  act: (a: any) => void;
  leave: () => void;
};

const NetContext = createContext<Ctx>(null as any);
export const useNet = () => useContext(NetContext);

const lineReader = (cb: (m: any) => void) => {
  let buf = "";
  return (chunk: any) => {
    buf += String(chunk);
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      try {
        cb(JSON.parse(line));
      } catch {}
    }
  };
};

export function NetProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hostIp, setHostIp] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Reaction[]>([]);

  const game = useRef<GameState | null>(null);
  const server = useRef<any>(null);
  const clients = useRef<Map<string, any>>(new Map());
  const client = useRef<any>(null);
  const nextId = useRef(1);
  const lastEmoji = useRef<Record<string, number>>({});

  const addReaction = useCallback((r: Reaction) => {
    setReactions((list) => [...list, r]);
    setTimeout(
      () => setReactions((list) => list.filter((x) => x.key !== r.key)),
      2200,
    );
  }, []);

  const publish = useCallback(() => {
    const s = game.current;
    if (!s) return;
    const copy = JSON.parse(JSON.stringify(s));
    setState(copy);
    const line = JSON.stringify({ type: "state", state: copy }) + "\n";
    clients.current.forEach((sock) => {
      try {
        sock.write(line);
      } catch {}
    });
  }, []);

  const onAction = useCallback(
    (id: string, a: any) => {
      const s = game.current;
      if (!s) return;

      if (a.type === "emoji") {
        const now = Date.now();
        if (
          !REACTIONS.includes(a.e) ||
          now - (lastEmoji.current[id] || 0) < 700
        )
          return;
        lastEmoji.current[id] = now;
        const r: Reaction = { key: `${id}-${now}`, from: id, e: a.e };
        addReaction(r);
        const line = JSON.stringify({ type: "emoji", item: r }) + "\n";
        clients.current.forEach((sock) => {
          try {
            sock.write(line);
          } catch {}
        });
        return;
      }

      if (a.type === "start" && id === s.hostId && s.phase === "lobby")
        startGame(s);
      else if (a.type === "reset" && id === s.hostId && s.phase === "finished")
        resetToLobby(s);
      else if (a.type === "roll") {
        const r = roll(s, id);
        if (r === "pass") {
          setTimeout(() => {
            if (
              game.current === s &&
              s.phase === "playing" &&
              s.dice !== null &&
              s.movable.length === 0
            ) {
              nextTurn(s);
              publish();
            }
          }, 1400);
        } else if (r === "wait" && AUTO_MOVE) {
          // only one distinct move possible -> play it automatically after the dice has settled
          const progress = new Set(s.movable.map((k) => s.tokens[s.turn][k]));
          if (progress.size === 1) {
            const rollNo = s.rolls;
            setTimeout(() => {
              if (
                game.current === s &&
                s.phase === "playing" &&
                s.rolls === rollNo &&
                s.dice !== null &&
                s.movable.length
              ) {
                move(s, id, s.movable[0]);
                publish();
              }
            }, 1100);
          }
        }
      } else if (a.type === "move") move(s, id, a.token);
      publish();
    },
    [publish, addReaction],
  );

  const cleanup = useCallback(() => {
    try {
      server.current?.close();
    } catch {}
    clients.current.forEach((s) => {
      try {
        s.destroy();
      } catch {}
    });
    clients.current.clear();
    try {
      client.current?.destroy();
    } catch {}
    server.current = null;
    client.current = null;
    game.current = null;
    setRole(null);
    setState(null);
    setMyId(null);
    setBusy(false);
    setReactions([]);
  }, []);

  const hostGame = useCallback(
    async (name: string) => {
      cleanup();
      setError(null);
      setBusy(true);
      try {
        const ip = await Network.getIpAddressAsync();
        setHostIp(ip && ip !== "0.0.0.0" ? ip : null);
      } catch {
        setHostIp(null);
      }

      const s = newLobby("host");
      addPlayer(s, "host", name || "Host");
      game.current = s;

      const srv = TcpSocket.createServer((socket: any) => {
        let id: string | null = null;
        socket.setEncoding("utf8");
        socket.on(
          "data",
          lineReader((m) => {
            const g = game.current;
            if (!g) return;
            if (m.type === "join" && !id) {
              const fail = (message: string) => {
                socket.write(JSON.stringify({ type: "error", message }) + "\n");
                setTimeout(() => {
                  try {
                    socket.destroy();
                  } catch {}
                }, 200);
              };
              if (m.code !== ROOM_CODE) return fail("Wrong room code");
              if (g.phase !== "lobby") return fail("Game already started");
              if (g.players.length >= 4) return fail("Room is full (4/4)");
              const newId = String(nextId.current++);
              addPlayer(g, newId, m.name);
              id = newId;
              clients.current.set(newId, socket);
              socket.write(
                JSON.stringify({ type: "joined", id: newId }) + "\n",
              );
              publish();
            } else if (id) onAction(id, m);
          }),
        );
        const gone = () => {
          if (!id) return;
          clients.current.delete(id);
          if (game.current) {
            disconnect(game.current, id);
            publish();
          }
          id = null;
        };
        socket.on("close", gone);
        socket.on("error", gone);
      });
      srv.on("error", (e: any) => {
        setError("Server error: " + (e?.message || e));
        setBusy(false);
      });
      srv.listen({ port: PORT, host: "0.0.0.0" }, () => {
        server.current = srv;
        setRole("host");
        setMyId("host");
        setBusy(false);
        publish();
      });
    },
    [cleanup, onAction, publish],
  );

  const joinGame = useCallback(
    (ip: string, name: string, code: string) => {
      cleanup();
      setError(null);
      setBusy(true);
      let joined = false;
      const timer = setTimeout(() => {
        if (!joined) {
          try {
            sock.destroy();
          } catch {}
          setBusy(false);
          setError(
            "Cannot reach host. Check IP, same Wi-Fi/hotspot, and turn OFF mobile data.",
          );
        }
      }, 7000);

      const sock: any = TcpSocket.createConnection(
        { host: ip.trim(), port: PORT },
        () => {
          sock.write(
            JSON.stringify({ type: "join", name: name || "Player", code }) +
              "\n",
          );
        },
      );
      client.current = sock;
      sock.setEncoding("utf8");
      sock.on(
        "data",
        lineReader((m) => {
          if (m.type === "joined") {
            joined = true;
            clearTimeout(timer);
            setRole("client");
            setMyId(m.id);
            setBusy(false);
          } else if (m.type === "state") setState(m.state);
          else if (m.type === "emoji") addReaction(m.item);
          else if (m.type === "error") {
            clearTimeout(timer);
            setError(m.message);
            setBusy(false);
          }
        }),
      );
      sock.on("error", () => {
        clearTimeout(timer);
        setBusy(false);
        setError("Connection failed");
      });
      sock.on("close", () => {
        clearTimeout(timer);
        if (joined) {
          setError("Disconnected from host");
        }
        setRole(null);
        setState(null);
        setMyId(null);
        setBusy(false);
      });
    },
    [cleanup, addReaction],
  );

  const act = useCallback(
    (a: any) => {
      if (role === "host") onAction("host", a);
      else client.current?.write(JSON.stringify(a) + "\n");
    },
    [role, onAction],
  );

  return (
    <NetContext.Provider
      value={{
        role,
        state,
        myId,
        error,
        busy,
        hostIp,
        reactions,
        hostGame,
        joinGame,
        act,
        leave: cleanup,
      }}
    >
      {children}
    </NetContext.Provider>
  );
}
