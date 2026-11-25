import React, { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";

function Floating({ e }: { e: string }) {
  const t = useRef(new Animated.Value(0)).current;
  const isText = /[A-Za-z]/.test(e);
  useEffect(() => {
    Animated.timing(t, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: -8,
        alignItems: "center",
        zIndex: 60,
        opacity: t.interpolate({
          inputRange: [0, 0.75, 1],
          outputRange: [1, 1, 0],
        }),
        transform: [
          {
            translateY: t.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -64],
            }),
          },
          {
            scale: t.interpolate({
              inputRange: [0, 0.12, 0.25, 1],
              outputRange: [0.3, 1.45, 1.15, 1.15],
            }),
          },
        ],
      }}
    >
      {isText ? (
        <View
          style={{
            backgroundColor: "#fff",
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 14,
            elevation: 6,
          }}
        >
          <Text style={{ color: "#0f172a", fontWeight: "800", fontSize: 14 }}>
            {e}
          </Text>
        </View>
      ) : (
        <Text style={{ fontSize: 46 }}>{e}</Text>
      )}
    </Animated.View>
  );
}

type Props = {
  name: string;
  label: string; // colour name
  color: string;
  home: number;
  isTurn: boolean;
  isMe: boolean;
  connected: boolean;
  reactions: { key: string; e: string }[];
};

export default function PlayerTag({
  name,
  label,
  color,
  home,
  isTurn,
  isMe,
  connected,
  reactions,
}: Props) {
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isTurn) {
      glow.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isTurn]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <View
        style={{
          minWidth: 130,
          paddingHorizontal: 12,
          paddingVertical: 5,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: color,
          backgroundColor: "#1e293b",
          overflow: "hidden",
          opacity: connected ? 1 : 0.45,
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: color,
            opacity: Animated.multiply(glow, 0.4),
          }}
        />
        <Text
          numberOfLines={1}
          style={{
            color: "#fff",
            fontWeight: "800",
            fontSize: 14,
            textAlign: "center",
          }}
        >
          {name}
          {isMe ? " (You)" : ""}
          {!connected ? " - left" : ""}
        </Text>
        <Text style={{ color: "#94a3b8", fontSize: 11, textAlign: "center" }}>
          {label} · {home}/4 home
        </Text>
      </View>
      {reactions.map((r) => (
        <Floating key={r.key} e={r.e} />
      ))}
    </View>
  );
}
