import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNet } from "../lib/net";
import { ROOM_CODE } from "../lib/ludo";

export default function Menu() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hostGame, joinGame, state, myId, error, busy } = useNet();
  const [name, setName] = useState("");
  const [ip, setIp] = useState("192.168.43.1");
  const [code, setCode] = useState(ROOM_CODE);

  useEffect(() => {
    if (state && myId) router.replace("/game");
  }, [state, myId]);

  return (
    <ScrollView
      style={{ backgroundColor: "#0f172a" }}
      contentContainerStyle={[
        s.container,
        { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.title}>🎲 Offline Ludo</Text>
      <Text style={s.sub}>2–4 players · no internet needed</Text>

      <TextInput
        style={s.input}
        placeholder="Your name"
        placeholderTextColor="#64748b"
        value={name}
        onChangeText={setName}
        maxLength={12}
      />

      <Text style={s.h}>Host a game</Text>
      <Text style={s.hint}>One phone hosts. Room code is {ROOM_CODE}.</Text>
      <Pressable
        style={[s.btn, busy && { opacity: 0.6 }]}
        disabled={busy}
        onPress={() => hostGame(name)}
      >
        <Text style={s.btnText}>Create Room</Text>
      </Pressable>

      <Text style={s.h}>Join a game</Text>
      <TextInput
        style={s.input}
        placeholder="Host IP"
        placeholderTextColor="#64748b"
        value={ip}
        onChangeText={setIp}
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
      />
      <TextInput
        style={s.input}
        placeholder="Room code"
        placeholderTextColor="#64748b"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={4}
      />
      <Pressable
        style={[
          s.btn,
          { backgroundColor: "#22c55e" },
          busy && { opacity: 0.6 },
        ]}
        disabled={busy}
        onPress={() => joinGame(ip, name, code)}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.btnText}>Join Room</Text>
        )}
      </Pressable>

      {error && <Text style={s.error}>{error}</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { padding: 24, paddingTop: 70, gap: 12 },
  title: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "800",
    textAlign: "center",
  },
  sub: { color: "#94a3b8", textAlign: "center", marginBottom: 12 },
  h: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 14 },
  hint: { color: "#94a3b8" },
  input: {
    backgroundColor: "#1e293b",
    color: "#fff",
    padding: 14,
    borderRadius: 10,
    fontSize: 16,
  },
  btn: {
    backgroundColor: "#6366f1",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  error: { color: "#f87171", textAlign: "center", marginTop: 8 },
});
