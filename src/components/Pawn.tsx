import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import { posOf } from "../lib/ludo";

type Props = {
  seat: number;
  k: number; // token index 0..3
  p: number; // progress: -1 yard, 0..55 path, 56 home
  n: number; // index among pawns sharing this square (or among this colour's home pawns)
  count: number; // how many pawns share this square
  cell: number;
  color: string;
  hot: boolean; // this token can move now
  tappable: boolean; // and it is my turn
  onPress: () => void;
};

// offsets (in cell units, from the cell centre) when 1..4 pawns share one square - nobody hides anybody
const SHARE: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [
    [-0.25, 0],
    [0.25, 0],
  ],
  3: [
    [0, -0.25],
    [-0.26, 0.2],
    [0.26, 0.2],
  ],
  4: [
    [-0.25, -0.25],
    [0.25, -0.25],
    [-0.25, 0.25],
    [0.25, 0.25],
  ],
};
// 4 slots inside a colour's centre triangle (red = left triangle). Seat s = same pattern turned s*90deg clockwise.
const HOME_SLOTS: [number, number][] = [
  [-1.23, -0.38],
  [-1.23, 0.38],
  [-0.7, -0.38],
  [-0.7, 0.38],
];

const BASE = 0.74; // rendered pawn diameter in cells (everything else is scaled from this)

export const centerOf = (
  seat: number,
  p: number,
  k: number,
  n: number,
  count: number,
): [number, number] => {
  if (p === 56) {
    let [dx, dy] = HOME_SLOTS[Math.min(n, 3)];
    for (let i = 0; i < seat; i++) [dx, dy] = [-dy, dx];
    return [7.5 + dx, 7.5 + dy];
  }
  const [x, y] = posOf(seat, p, k);
  const list = SHARE[Math.max(1, Math.min(count, 4))];
  const [ox, oy] = list[Math.min(n, list.length - 1)];
  return [x + 0.5 + ox, y + 0.5 + oy];
};

export const diameterOf = (p: number, count: number) =>
  p === 56 ? 0.42 : p < 0 || count <= 1 ? BASE : count === 2 ? 0.48 : 0.44;

export default function Pawn({
  seat,
  k,
  p,
  n,
  count,
  cell,
  color,
  hot,
  tappable,
  onPress,
}: Props) {
  const D = cell * BASE;
  const targetPos = (pp: number, nn: number, cc: number) => {
    const [cx, cy] = centerOf(seat, pp, k, nn, cc);
    return { x: cx * cell - D / 2, y: cy * cell - D / 2 };
  };

  const pos = useRef(new Animated.ValueXY(targetPos(p, n, count))).current;
  const sc = useRef(new Animated.Value(diameterOf(p, count) / BASE)).current;
  const hop = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(1)).current; // 1 = finished (invisible)
  const scale = useMemo(() => Animated.multiply(sc, hop), []);
  const prevP = useRef(p);
  const wasHome = useRef(p === 56);
  const running = useRef<Animated.CompositeAnimation | null>(null);

  // ---- movement: hop square by square along the path; slide straight for yard / capture moves
  useEffect(() => {
    const prev = prevP.current;
    prevP.current = p;
    running.current?.stop();

    const stepByStep = prev >= 0 && p > prev && p - prev <= 6;
    const targets: { x: number; y: number }[] = [];
    if (stepByStep) {
      for (let q = prev + 1; q <= p; q++)
        targets.push(q === p ? targetPos(q, n, count) : targetPos(q, 0, 1));
    } else {
      targets.push(targetPos(p, n, count));
    }

    const duration = stepByStep ? 150 : prev > p ? 450 : 260;
    const anims = targets.map((t) => {
      const parts: Animated.CompositeAnimation[] = [
        Animated.timing(pos, {
          toValue: t,
          duration,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ];
      if (stepByStep) {
        parts.push(
          Animated.sequence([
            Animated.timing(hop, {
              toValue: 1.3,
              duration: duration / 2,
              useNativeDriver: true,
            }),
            Animated.timing(hop, {
              toValue: 1,
              duration: duration / 2,
              useNativeDriver: true,
            }),
          ]),
        );
      }
      return Animated.parallel(parts);
    });
    running.current = Animated.sequence(anims);
    running.current.start();
  }, [p, n, count, cell]);

  // ---- shrink / grow when squares get shared
  useEffect(() => {
    Animated.timing(sc, {
      toValue: diameterOf(p, count) / BASE,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [p, count]);

  // ---- golden ring when this pawn reaches home
  useEffect(() => {
    if (p === 56 && !wasHome.current) {
      burst.setValue(0);
      Animated.timing(burst, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
    wasHome.current = p === 56;
  }, [p]);

  // ---- pulse ring while this token is movable
  useEffect(() => {
    if (!hot) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [hot]);

  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.9],
  });
  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 0],
  });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: D,
        height: D,
        zIndex: hot ? 30 : p === 56 ? 12 + n : 10 + n,
        transform: [{ translateX: pos.x }, { translateY: pos.y }, { scale }],
      }}
    >
      {hot && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: D,
            height: D,
            borderRadius: D / 2,
            backgroundColor: color,
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          }}
        />
      )}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: D,
          height: D,
          borderRadius: D / 2,
          borderWidth: 4,
          borderColor: "#fbbf24",
          opacity: burst.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0],
          }),
          transform: [
            {
              scale: burst.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 4],
              }),
            },
          ],
        }}
      />
      <Pressable
        disabled={!tappable}
        onPress={onPress}
        hitSlop={cell * 0.2}
        style={{
          width: D,
          height: D,
          borderRadius: D / 2,
          backgroundColor: color,
          borderWidth: hot ? 3 : 2,
          borderColor: hot ? "#000" : "#fff",
          alignItems: "center",
          justifyContent: "center",
          elevation: 4,
          shadowColor: "#000",
          shadowOpacity: 0.35,
          shadowRadius: 2,
          shadowOffset: { width: 0, height: 1 },
        }}
      >
        <View
          style={{
            width: D * 0.46,
            height: D * 0.46,
            borderRadius: D * 0.23,
            backgroundColor: "rgba(255,255,255,0.45)",
          }}
        />
      </Pressable>
    </Animated.View>
  );
}
