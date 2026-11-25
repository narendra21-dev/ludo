import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';

const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};

type Props = {
  value: number | null;
  rollKey: number; // changes on every roll
  color: string;
  size?: number;
  onSettled?: (rollKey: number) => void;
};

export default function Dice({ value, rollKey, color, size = 64, onSettled }: Props) {
  const spin = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const [face, setFace] = useState<number | null>(value);
  const mounted = useRef(false);

  useEffect(() => {
    const isFirst = !mounted.current;
    mounted.current = true;

    if (value === null) {
      setFace(null);
      onSettled?.(rollKey);
      return;
    }
    if (isFirst) {
      setFace(value);
      onSettled?.(rollKey);
      return;
    }

    // rolling animation: random faces + spin + pop, then show the real value
    const flicker = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 70);
    spin.setValue(0);
    pop.setValue(1);
    Animated.parallel([
      Animated.timing(spin, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(pop, { toValue: 1.3, duration: 220, useNativeDriver: true }),
        Animated.timing(pop, { toValue: 1, duration: 430, useNativeDriver: true }),
      ]),
    ]).start();
    const done = setTimeout(() => {
      clearInterval(flicker);
      setFace(value);
      onSettled?.(rollKey);
    }, 650);
    return () => { clearInterval(flicker); clearTimeout(done); };
  }, [rollKey, value]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '720deg'] });
  const pad = size * 0.22;
  const inner = size - pad * 2;
  const pip = size * 0.19;

  return (
    <Animated.View
      style={{
        width: size, height: size, borderRadius: size * 0.2, backgroundColor: '#fff',
        elevation: 6, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
        transform: [{ rotate }, { scale: pop }],
      }}>
      {face === null ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: size * 0.45, color: '#cbd5e1', fontWeight: '900' }}>?</Text>
        </View>
      ) : (
        PIPS[face].map(([c, r], i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: pad + (c * inner) / 2 - pip / 2,
              top: pad + (r * inner) / 2 - pip / 2,
              width: pip, height: pip, borderRadius: pip / 2, backgroundColor: color,
            }}
          />
        ))
      )}
    </Animated.View>
  );
}
