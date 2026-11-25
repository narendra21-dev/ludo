import React, { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import {
  COLORS,
  GameState,
  HOME_COL,
  SAFE,
  TRACK,
  YARD,
  posOf,
} from "../lib/ludo";
import Pawn from "./Pawn";

const ORIGIN = [
  [0, 0],
  [9, 0],
  [9, 9],
  [0, 9],
];

// pulsing white frame around the yard of the player whose turn it is
function TurnGlow({ seat, cell }: { seat: number; cell: number }) {
  const o = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(o, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(o, {
          toValue: 0.25,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [seat]);
  const [ox, oy] = ORIGIN[seat];
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: ox * cell,
        top: oy * cell,
        width: 6 * cell,
        height: 6 * cell,
        borderWidth: 4,
        borderColor: "#fff",
        opacity: o,
        zIndex: 5,
      }}
    />
  );
}

export default function Board({
  state,
  myId,
  size,
  onMove,
  locked = false,
  viewSeat,
}: {
  state: GameState;
  myId: string;
  size: number;
  onMove: (k: number) => void;
  locked?: boolean;
  viewSeat?: number;
}) {
  const cell = size / 15;
  // Rotate the whole board so MY yard is always bottom-left (seat 3's spot). Game logic is untouched.
  const rot = viewSeat === undefined ? 0 : ((3 - viewSeat + 4) % 4) * 90;
  const myTurn = state.players[state.turn]?.id === myId;

  const rect = (
    key: string,
    x: number,
    y: number,
    w: number,
    h: number,
    bg: string,
    extra: any = {},
  ) => (
    <View
      key={key}
      style={{
        position: "absolute",
        left: x * cell,
        top: y * cell,
        width: w * cell,
        height: h * cell,
        backgroundColor: bg,
        ...extra,
      }}
    />
  );

  // empty "nest" circles in every yard: a big ring + inner circle behind each pawn
  const nests: React.ReactNode[] = [];
  YARD.forEach((slots, s) =>
    slots.forEach(([x, y], k) => {
      const big = cell * 1.3;
      const mid = cell * 0.98;
      nests.push(
        <View
          key={`nest${s}-${k}`}
          style={{
            position: "absolute",
            left: x * cell + cell / 2 - big / 2,
            top: y * cell + cell / 2 - big / 2,
            width: big,
            height: big,
            borderRadius: big / 2,
            backgroundColor: COLORS[s] + "26",
            borderWidth: 3,
            borderColor: COLORS[s] + "AA",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: mid,
              height: mid,
              borderRadius: mid / 2,
              backgroundColor: COLORS[s] + "40",
            }}
          />
        </View>,
      );
    }),
  );

  // how many pawns share each square (so they can be laid out side by side instead of hiding each other)
  const keyOf = (seat: number, p: number, k: number) =>
    p < 0
      ? `y${seat}-${k}`
      : p === 56
        ? `fin${seat}`
        : p <= 50
          ? `m${(seat * 13 + p) % 52}`
          : `h${seat}-${p}`;
  const counts: Record<string, number> = {};
  state.players.forEach((pl, i) =>
    state.tokens[i]?.forEach((p, k) => {
      const key = keyOf(pl.seat, p, k);
      counts[key] = (counts[key] || 0) + 1;
    }),
  );
  const placed: Record<string, number> = {};
  const pawns: React.ReactNode[] = [];
  state.players.forEach((pl, i) =>
    state.tokens[i]?.forEach((p, k) => {
      const key = keyOf(pl.seat, p, k);
      const n = placed[key] || 0;
      placed[key] = n + 1;
      const hot =
        !locked &&
        i === state.turn &&
        state.movable.includes(k) &&
        state.phase === "playing";
      pawns.push(
        <Pawn
          key={`p${i}-${k}`}
          seat={pl.seat}
          k={k}
          p={p}
          n={n}
          count={counts[key]}
          cell={cell}
          color={COLORS[pl.seat]}
          hot={hot}
          tappable={hot && myTurn}
          onPress={() => onMove(k)}
        />,
      );
    }),
  );

  // faint rings showing where each movable pawn would land (only for the player whose turn it is)
  const hints: React.ReactNode[] = [];
  if (!locked && myTurn && state.phase === "playing" && state.dice !== null) {
    const pl = state.players[state.turn];
    const seen = new Set<string>();
    state.movable.forEach((k) => {
      const p = state.tokens[state.turn][k];
      const np = p === -1 ? 0 : p + (state.dice as number);
      const [x, y] = posOf(pl.seat, np, k);
      const hk = `${x},${y}`;
      if (seen.has(hk)) return;
      seen.add(hk);
      const r = cell * 0.9;
      hints.push(
        <View
          key={`hint${hk}`}
          pointerEvents="none"
          style={{
            position: "absolute",
            left: x * cell + (cell - r) / 2,
            top: y * cell + (cell - r) / 2,
            width: r,
            height: r,
            borderRadius: r / 2,
            borderWidth: 3,
            borderColor: COLORS[pl.seat],
            backgroundColor: COLORS[pl.seat] + "33",
            zIndex: 8,
          }}
        />,
      );
    });
  }

  const turnSeat =
    state.phase === "playing" ? state.players[state.turn]?.seat : undefined;

  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#334155",
        transform: [{ rotate: `${rot}deg` }],
      }}
    >
      {ORIGIN.map(([ox, oy], s) => (
        <React.Fragment key={`q${s}`}>
          {rect(`qa${s}`, ox, oy, 6, 6, COLORS[s])}
          {rect(`qb${s}`, ox + 1, oy + 1, 4, 4, "#fff", {
            borderRadius: cell * 0.5,
          })}
        </React.Fragment>
      ))}

      {nests}

      {TRACK.map(([x, y], i) => (
        <View
          key={`c${i}`}
          style={{
            position: "absolute",
            left: x * cell,
            top: y * cell,
            width: cell,
            height: cell,
            backgroundColor: i % 13 === 0 ? COLORS[i / 13] : "#fff",
            borderWidth: 0.5,
            borderColor: "#94a3b8",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {SAFE.includes(i) && i % 13 !== 0 && (
            <Text
              style={{
                fontSize: cell * 0.6,
                color: "#64748b",
                transform: [{ rotate: `${-rot}deg` }],
              }}
            >
              ★
            </Text>
          )}
        </View>
      ))}

      {HOME_COL.map((col, s) =>
        col.map(([x, y], j) =>
          rect(`h${s}-${j}`, x, y, 1, 1, COLORS[s], {
            borderWidth: 0.5,
            borderColor: "#fff",
          }),
        ),
      )}

      {/* center triangles */}
      <View
        style={{
          position: "absolute",
          left: 6 * cell,
          top: 6 * cell,
          width: 0,
          height: 0,
          borderTopWidth: 1.5 * cell,
          borderBottomWidth: 1.5 * cell,
          borderLeftWidth: 1.5 * cell,
          borderTopColor: "transparent",
          borderBottomColor: "transparent",
          borderLeftColor: COLORS[0],
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 6 * cell,
          top: 6 * cell,
          width: 0,
          height: 0,
          borderLeftWidth: 1.5 * cell,
          borderRightWidth: 1.5 * cell,
          borderTopWidth: 1.5 * cell,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: COLORS[1],
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 7.5 * cell,
          top: 6 * cell,
          width: 0,
          height: 0,
          borderTopWidth: 1.5 * cell,
          borderBottomWidth: 1.5 * cell,
          borderRightWidth: 1.5 * cell,
          borderTopColor: "transparent",
          borderBottomColor: "transparent",
          borderRightColor: COLORS[2],
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 6 * cell,
          top: 7.5 * cell,
          width: 0,
          height: 0,
          borderLeftWidth: 1.5 * cell,
          borderRightWidth: 1.5 * cell,
          borderBottomWidth: 1.5 * cell,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderBottomColor: COLORS[3],
        }}
      />

      {turnSeat !== undefined && <TurnGlow seat={turnSeat} cell={cell} />}

      {hints}

      {pawns}
    </View>
  );
}
