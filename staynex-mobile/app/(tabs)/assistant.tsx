import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { AgentMessageFeedback, PropertySummary } from "@staynex/backend/types";
import { color, fontSize, fontWeight, radius, spacing } from "@staynex/shared";
import { aiApi } from "@/data/ai";
import { apiErrorMessage } from "@/core/client";
import { streamAssistant, type StreamHandle } from "@/core/ai-stream";
import { useSession } from "@/core/session";
import { Screen } from "@/ui/Screen";
import { PropertyCard } from "@/ui/PropertyCard";

// Local view of one chat turn. Server truth (ids, cards, feedback) is attached
// when the backend persists the turn — the client never invents any of it.
interface ChatMessage {
  key: string;
  id: string | null; // persisted message id (null while streaming)
  role: "USER" | "AGENT";
  content: string;
  properties: PropertySummary[];
  feedback: AgentMessageFeedback | null;
  streaming?: boolean;
  failed?: boolean;
}

let keyCounter = 0;
const nextKey = () => `m${++keyCounter}`;

export default function AssistantScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const user = useSession((s) => s.user);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingUserMessageId, setEditingUserMessageId] = useState<string | null>(null);
  const streamRef = useRef<StreamHandle | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // History can hand over a conversation to resume (?open=<id>).
  const openParam = typeof params.open === "string" ? params.open : undefined;
  useEffect(() => {
    if (!openParam || openParam === conversationId) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await aiApi.messages(openParam);
        if (cancelled) return;
        setConversationId(openParam);
        setMessages(
          rows.map((m) => ({
            key: nextKey(),
            id: m.id,
            role: m.role,
            content: m.content,
            properties: m.properties ?? [],
            feedback: m.feedback,
          })),
        );
      } catch {
        /* conversation may be gone; stay on the current one */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openParam, conversationId]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  function runTurn(
    text: string,
    operation?: { type: "retry"; assistantMessageId: string } | { type: "edit"; userMessageId: string },
  ) {
    setBusy(true);
    const agentKey = nextKey();

    setMessages((prev) => {
      let next = [...prev];
      if (operation?.type === "retry") {
        // The retried answer is superseded server-side; drop it locally too.
        next = next.filter((m) => m.id !== operation.assistantMessageId);
      } else if (operation?.type === "edit") {
        // Editing replaces the latest user turn and its answer.
        const idx = next.findIndex((m) => m.id === operation.userMessageId);
        if (idx >= 0) next = next.slice(0, idx);
        next.push({
          key: nextKey(),
          id: null,
          role: "USER",
          content: text,
          properties: [],
          feedback: null,
        });
      } else {
        next.push({
          key: nextKey(),
          id: null,
          role: "USER",
          content: text,
          properties: [],
          feedback: null,
        });
      }
      next.push({
        key: agentKey,
        id: null,
        role: "AGENT",
        content: "",
        properties: [],
        feedback: null,
        streaming: true,
      });
      return next;
    });
    scrollToEnd();

    streamRef.current = streamAssistant(
      { message: text, conversationId: conversationId ?? undefined, operation },
      {
        onChunk: (chunk) => {
          setMessages((prev) =>
            prev.map((m) => (m.key === agentKey ? { ...m, content: m.content + chunk } : m)),
          );
          scrollToEnd();
        },
        onDone: (done) => {
          setBusy(false);
          setConversationId(done.conversationId || conversationId);
          setMessages((prev) => {
            const next = prev.map((m) =>
              m.key === agentKey
                ? { ...m, id: done.messageId || null, properties: done.properties, streaming: false }
                : m,
            );
            // Attach the persisted id to the newest user turn of this exchange.
            for (let i = next.length - 1; i >= 0; i--) {
              if (next[i].role === "USER" && next[i].id === null) {
                next[i] = { ...next[i], id: done.userMessageId || null };
                break;
              }
            }
            return next;
          });
          scrollToEnd();
        },
        onError: (message) => {
          setBusy(false);
          setMessages((prev) =>
            prev.map((m) =>
              m.key === agentKey
                ? { ...m, content: m.content || message, streaming: false, failed: true }
                : m,
            ),
          );
        },
      },
    );
  }

  function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    if (editingUserMessageId) {
      const op = { type: "edit" as const, userMessageId: editingUserMessageId };
      setEditingUserMessageId(null);
      runTurn(text, op);
    } else {
      runTurn(text);
    }
  }

  const lastAgent = [...messages].reverse().find((m) => m.role === "AGENT" && m.id);
  const lastUser = [...messages].reverse().find((m) => m.role === "USER" && m.id);

  function retryLast() {
    if (!lastAgent?.id || !lastUser || busy) return;
    runTurn(lastUser.content, { type: "retry", assistantMessageId: lastAgent.id });
  }

  function editLast() {
    if (!lastUser?.id || busy) return;
    setEditingUserMessageId(lastUser.id);
    setInput(lastUser.content);
  }

  async function rate(message: ChatMessage, value: AgentMessageFeedback) {
    if (!conversationId || !message.id) return;
    const next = message.feedback === value ? null : value; // tri-state toggle
    setMessages((prev) => prev.map((m) => (m.key === message.key ? { ...m, feedback: next } : m)));
    try {
      await aiApi.setFeedback(conversationId, message.id, next);
    } catch (err) {
      // Revert on failure — feedback state is server truth.
      setMessages((prev) =>
        prev.map((m) => (m.key === message.key ? { ...m, feedback: message.feedback } : m)),
      );
      void apiErrorMessage(err, "");
    }
  }

  function startNewConversation() {
    streamRef.current?.abort();
    setConversationId(null);
    setMessages([]);
    setEditingUserMessageId(null);
    setBusy(false);
  }

  return (
    <Screen edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.heading}>Staynex AI</Text>
        <View style={styles.headerActions}>
          {messages.length > 0 ? (
            <Pressable accessibilityRole="button" onPress={startNewConversation}>
              <Text style={styles.headerLink}>New chat</Text>
            </Pressable>
          ) : null}
          {user ? (
            <Pressable accessibilityRole="button" onPress={() => router.push("/assistant/history")}>
              <Text style={styles.headerLink}>History</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        {messages.length === 0 ? (
          <View style={styles.welcome}>
            <Text style={styles.welcomeTitle}>Ask Staynex AI</Text>
            <Text style={styles.welcomeBody}>
              Compare stays, understand rooms and policies, and get guided through
              booking. Availability and payments always come from the platform —
              never guessed.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.key}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isLastAgent={item.key === lastAgent?.key}
                busy={busy}
                onRate={(value) => void rate(item, value)}
                onRetry={retryLast}
                onEdit={editLast}
                onOpenStay={(slug) =>
                  router.push({ pathname: "/stays/[slug]", params: { slug } })
                }
              />
            )}
          />
        )}

        {editingUserMessageId ? (
          <View style={styles.editingBanner}>
            <Text style={styles.editingText}>Editing your last message</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setEditingUserMessageId(null);
                setInput("");
              }}
            >
              <Text style={styles.headerLink}>Cancel</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about stays, rooms, booking…"
            placeholderTextColor={color.muted}
            multiline
            maxLength={1000}
            editable={!busy}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy || !input.trim() }}
            disabled={busy || !input.trim()}
            onPress={send}
            style={({ pressed }) => [
              styles.sendBtn,
              (busy || !input.trim()) && styles.sendBtnDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.sendLabel}>{busy ? "…" : "Send"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function MessageBubble({
  message,
  isLastAgent,
  busy,
  onRate,
  onRetry,
  onEdit,
  onOpenStay,
}: {
  message: ChatMessage;
  isLastAgent: boolean;
  busy: boolean;
  onRate: (value: AgentMessageFeedback) => void;
  onRetry: () => void;
  onEdit: () => void;
  onOpenStay: (slug: string) => void;
}) {
  const isUser = message.role === "USER";
  return (
    <View style={[styles.bubbleWrap, isUser ? styles.bubbleWrapUser : null]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAgent, message.failed && styles.bubbleFailed]}>
        <Text style={isUser ? styles.bubbleTextUser : styles.bubbleText}>
          {message.content || (message.streaming ? "…" : "")}
        </Text>
      </View>

      {message.properties.length > 0 ? (
        <View style={styles.cards}>
          {message.properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              onPress={() => onOpenStay(property.slug)}
            />
          ))}
        </View>
      ) : null}

      {!isUser && isLastAgent && message.id && !busy ? (
        <View style={styles.actionsRow}>
          <Pressable accessibilityRole="button" onPress={() => onRate("UP")}>
            <Text style={[styles.action, message.feedback === "UP" && styles.actionActive]}>👍</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => onRate("DOWN")}>
            <Text style={[styles.action, message.feedback === "DOWN" && styles.actionActive]}>👎</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onRetry}>
            <Text style={styles.actionLink}>Regenerate</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onEdit}>
            <Text style={styles.actionLink}>Edit question</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  heading: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: color.ink },
  headerActions: { flexDirection: "row", gap: spacing.lg },
  headerLink: { color: color.primary, fontWeight: fontWeight.medium, fontSize: fontSize.sm },
  welcome: { flex: 1, justifyContent: "center", padding: spacing.xl, gap: spacing.sm },
  welcomeTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: color.ink, textAlign: "center" },
  welcomeBody: { fontSize: fontSize.sm, color: color.muted, textAlign: "center", lineHeight: 20 },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  bubbleWrap: { alignItems: "flex-start", gap: spacing.sm },
  bubbleWrapUser: { alignItems: "flex-end" },
  bubble: { maxWidth: "88%", borderRadius: radius.lg, padding: spacing.md },
  bubbleAgent: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.border },
  bubbleUser: { backgroundColor: color.primary },
  bubbleFailed: { borderColor: color.error },
  bubbleText: { fontSize: fontSize.md, color: color.ink, lineHeight: 21 },
  bubbleTextUser: { fontSize: fontSize.md, color: color.onPrimary, lineHeight: 21 },
  cards: { alignSelf: "stretch", gap: spacing.md },
  actionsRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  action: { fontSize: fontSize.md, opacity: 0.55 },
  actionActive: { opacity: 1 },
  actionLink: { color: color.primary, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  editingBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  editingText: { fontSize: fontSize.xs, color: color.warning },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: color.border,
    backgroundColor: color.background,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: color.ink,
    backgroundColor: color.surface,
  },
  sendBtn: {
    backgroundColor: color.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sendBtnDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  sendLabel: { color: color.onPrimary, fontWeight: fontWeight.semibold },
});
