import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

const CONFETTI = ['#ef4444', '#22c55e', '#eab308', '#3b82f6', '#fbbf24', '#ec4899', '#a855f7'];

function Piece({ i, w, h }: { i: number; w: number; h: number }) {
  const t = useRef(new Animated.Value(0)).current;
  const cfg = useMemo(() => ({
    x: Math.random() * w,
    delay: Math.random() * 1200,
    dur: 2600 + Math.random() * 1800,
    size: 8 + Math.random() * 8,
    color: CONFETTI[i % CONFETTI.length],
    sway: 20 + Math.random() * 40,
    spin: 360 + Math.random() * 720,
    round: Math.random() < 0.3,
  }), []);

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.delay(cfg.delay),
      Animated.loop(Animated.timing(t, { toValue: 1, duration: cfg.dur, easing: Easing.linear, useNativeDriver: true })),
    ]);
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute', left: cfg.x, top: -24,
        width: cfg.size, height: cfg.round ? cfg.size : cfg.size * 0.5,
        borderRadius: cfg.round ? cfg.size / 2 : 2, backgroundColor: cfg.color,
        transform: [
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, h + 48] }) },
          { translateX: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, cfg.sway, 0] }) },
          { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${cfg.spin}deg`] }) },
        ],
      }}
    />
  );
}

// full-screen falling confetti (does not block touches)
export function Confetti({ count = 44 }: { count?: number }) {
  const { width, height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 100 }]}>
      {Array.from({ length: count }).map((_, i) => <Piece key={i} i={i} w={width} h={height} />)}
    </View>
  );
}

// bouncing trophy + winner text
export function WinnerBanner({ name, isMe }: { name: string; isMe: boolean }) {
  const pop = useRef(new Animated.Value(0)).current;
  const wig = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wig, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(wig, { toValue: -1, duration: 450, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View style={{ alignItems: 'center', transform: [{ scale: pop }] }}>
      <Animated.Text
        style={{
          fontSize: 64,
          transform: [{ rotate: wig.interpolate({ inputRange: [-1, 1], outputRange: ['-12deg', '12deg'] }) }],
        }}>
        🏆
      </Animated.Text>
      <Text style={{ color: '#fbbf24', fontSize: 28, fontWeight: '900' }}>
        {isMe ? 'You win!' : `${name} wins!`}
      </Text>
      <Text style={{ color: '#94a3b8', fontSize: 13 }}>{isMe ? 'Great game!' : 'Better luck next time'}</Text>
    </Animated.View>
  );
}
