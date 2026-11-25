import { useKeepAwake } from "expo-keep-awake";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Board from "../components/Board";
import { Confetti, WinnerBanner } from "../components/Celebration";
import Dice from "../components/Dice";
import PlayerTag from "../components/PlayerTag";
import { COLORS, COLOR_NAMES, EMOJIS, QUICK_CHAT } from "../lib/ludo";
import { useNet } from "../lib/net";

export default function Game() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets(); // status bar / notch on top, gesture bar or 3-button bar at the bottom
  const { state, myId, role, hostIp, reactions, act, leave } = useNet();
  useKeepAwake(); // host phone must never sleep, or the server stops
  const [doneRoll, setDoneRoll] = useState(-1);
  const [showReact, setShowReact] = useState(false);
  const isHost = role === "host";

  const confirmLeave = () =>
    Alert.alert(
      isHost ? "End the game for everyone?" : "Leave the room?",
      isHost
        ? "You are the host, so the game ends for all players."
        : "You cannot rejoin once the game has started.",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => {
            leave();
            router.replace("/");
          },
        },
      ],
    );

  useEffect(() => {
    if (!state || !myId) router.replace("/");
  }, [state, myId]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      confirmLeave();
      return true;
    });
    return () => sub.remove();
  }, [isHost]);

  if (!state || !myId) return null;

  const me = state.players.find((p) => p.id === myId);
  const mySeat = me?.seat;
  const steps = mySeat === undefined ? 0 : (3 - mySeat + 4) % 4; // quarter-turns the board is rotated
  const cur = state.players[state.turn];
  const myTurn = cur?.id === myId;
  // board size: limited by width AND by the height really left after the system bars (so it fits without scrolling)
  const chrome = 380; // title + name tags + message + dice row + React button + Leave + gaps
  const size = Math.max(
    260,
    Math.min(width - 16, 440, height - insets.top - insets.bottom - chrome),
  );
  const locked = state.dice !== null && doneRoll !== state.rolls; // dice still rolling
  const winner =
    state.winner !== null && state.winner >= 0
      ? state.players[state.winner]
      : null;
  const sendReaction = (e: string) => {
    act({ type: "emoji", e });
    setShowReact(false);
  };

  // screen position 0=top-left 1=top-right 2=bottom-right 3=bottom-left (mine is always 3)
  const tagAt = (pos: number) => {
    const i = state.players.findIndex((p) => (p.seat + steps) % 4 === pos);
    if (i < 0) return <View style={{ flex: 1 }} />;
    const p = state.players[i];
    return (
      <PlayerTag
        key={p.id}
        name={p.name}
        label={COLOR_NAMES[p.seat]}
        color={COLORS[p.seat]}
        home={state.tokens[i]?.filter((t) => t === 56).length ?? 0}
        isTurn={state.phase === "playing" && i === state.turn}
        isMe={p.id === myId}
        connected={p.connected}
        reactions={reactions.filter((r) => r.from === p.id)}
      />
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          s.container,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Text style={s.code}>Room 1111 · {state.players.length}/4</Text>

        {state.phase === "lobby" && (
          <View style={{ gap: 10, alignItems: "center" }}>
            {isHost && (
              <Text style={s.hint}>
                Tell others to join with IP:{" "}
                {hostIp ??
                  '192.168.43.1 (or check "Gateway" in their Wi-Fi details)'}
              </Text>
            )}
            {state.players.map((p) => (
              <Text key={p.id} style={s.player}>
                {p.id === state.hostId ? "👑 " : "• "}
                {p.name}
                {p.id === myId ? " (you)" : ""}
              </Text>
            ))}
            {isHost ? (
              <Pressable
                style={[s.btn, state.players.length < 2 && { opacity: 0.4 }]}
                disabled={state.players.length < 2}
                onPress={() => act({ type: "start" })}
              >
                <Text style={s.btnText}>
                  {state.players.length < 2
                    ? "Waiting for players…"
                    : "Start Game"}
                </Text>
              </Pressable>
            ) : (
              <Text style={s.hint}>Waiting for host to start…</Text>
            )}
          </View>
        )}

        {state.phase !== "lobby" && (
          <>
            <View style={[s.tagRow, { width: size }]}>
              {tagAt(0)}
              {tagAt(1)}
            </View>

            <Board
              state={state}
              myId={myId}
              size={size}
              locked={locked}
              viewSeat={mySeat}
              onMove={(k) => act({ type: "move", token: k })}
            />

            <View style={[s.tagRow, { width: size }]}>
              {tagAt(3)}
              {tagAt(2)}
            </View>

            <Text style={s.msg}>{state.msg}</Text>

            {state.phase === "playing" && (
              <View style={s.diceRow}>
                <Dice
                  value={state.dice}
                  rollKey={state.rolls}
                  color={COLORS[cur?.seat ?? 0]}
                  onSettled={setDoneRoll}
                />
                <Pressable
                  style={[
                    s.btn,
                    { flex: 1 },
                    !(myTurn && state.dice === null) && { opacity: 0.4 },
                  ]}
                  disabled={!(myTurn && state.dice === null)}
                  onPress={() => act({ type: "roll" })}
                >
                  <Text style={s.btnText}>
                    {myTurn
                      ? state.dice === null
                        ? "Roll Dice"
                        : locked
                          ? "Rolling…"
                          : "Tap a glowing token"
                      : `${cur?.name}'s turn`}
                  </Text>
                </Pressable>
              </View>
            )}

            {state.phase === "finished" && (
              <>
                {winner && (
                  <WinnerBanner name={winner.name} isMe={winner.id === myId} />
                )}
                {isHost && (
                  <Pressable
                    style={s.btn}
                    onPress={() => act({ type: "reset" })}
                  >
                    <Text style={s.btnText}>Back to Lobby</Text>
                  </Pressable>
                )}
              </>
            )}

            <Pressable
              style={s.reactBtn}
              onPress={() => setShowReact((v) => !v)}
            >
              <Text style={s.reactBtnText}>
                {showReact ? "✕ Close" : "😊 React"}
              </Text>
            </Pressable>
            {showReact && (
              <View style={[s.panel, { width: size }]}>
                <View style={s.emojiGrid}>
                  {EMOJIS.map((e) => (
                    <Pressable
                      key={e}
                      style={s.emojiBtn}
                      onPress={() => sendReaction(e)}
                    >
                      <Text style={s.emoji}>{e}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={s.chatWrap}>
                  {QUICK_CHAT.map((t) => (
                    <Pressable
                      key={t}
                      style={s.chip}
                      onPress={() => sendReaction(t)}
                    >
                      <Text style={s.chipText}>{t}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        <Pressable onPress={confirmLeave}>
          <Text style={s.leave}>Leave</Text>
        </Pressable>
      </ScrollView>
      {state.phase === "finished" && winner && <Confetti />}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    padding: 8,
    paddingTop: 46,
    paddingBottom: 24,
    gap: 6,
    alignItems: "center",
  },
  code: { color: "#fff", fontSize: 18, fontWeight: "700" },
  hint: { color: "#94a3b8", textAlign: "center" },
  player: { color: "#fff", fontSize: 18 },
  btn: {
    backgroundColor: "#6366f1",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    minWidth: 200,
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  tagRow: { flexDirection: "row", height: 54, zIndex: 20 },
  msg: { color: "#e2e8f0", fontSize: 15, minHeight: 20 },
  diceRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    width: "92%",
  },
  win: { color: "#fbbf24", fontSize: 26, fontWeight: "800" },
  reactBtn: {
    backgroundColor: "#1e293b",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginTop: 4,
  },
  reactBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  panel: { backgroundColor: "#1e293b", borderRadius: 16, padding: 10, gap: 10 },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  emojiBtn: {
    backgroundColor: "#0f172a",
    borderRadius: 24,
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: { fontSize: 26 },
  chatWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  chip: {
    backgroundColor: "#334155",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  leave: { color: "#f87171", marginTop: 6 },
});
