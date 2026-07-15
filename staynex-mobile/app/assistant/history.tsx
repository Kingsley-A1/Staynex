import { useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AgentConversation } from "@staynex/backend/types";
import { color, fontSize, fontWeight, radius, spacing } from "@staynex/shared";
import { aiApi } from "@/data/ai";
import { apiErrorMessage } from "@/core/client";
import { useSession } from "@/core/session";
import { Screen } from "@/ui/Screen";
import { Button } from "@/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "@/ui/states";

export default function AssistantHistoryScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, status } = useSession();
  const [renaming, setRenaming] = useState<AgentConversation | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  const listQuery = useQuery({
    queryKey: ["ai-conversations", user?.id],
    queryFn: aiApi.conversations,
    enabled: Boolean(user),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });

  const pinMutation = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => aiApi.setPinned(id, pinned),
    onSettled: invalidate,
  });
  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => aiApi.rename(id, title),
    onSuccess: () => setRenaming(null),
    onSettled: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => aiApi.remove(id),
    onSettled: invalidate,
  });

  if (status !== "ready" || (user && listQuery.isLoading)) {
    return (
      <Screen padded>
        <LoadingState label="Loading conversations…" />
      </Screen>
    );
  }
  if (!user) {
    return (
      <Screen padded>
        <EmptyState
          title="Sign in for history"
          message="Guests can chat freely — sign in and your conversations are kept here."
        />
      </Screen>
    );
  }
  if (listQuery.isError) {
    return (
      <Screen padded>
        <ErrorState
          message={apiErrorMessage(listQuery.error, "Couldn't load conversations.")}
          onRetry={() => listQuery.refetch()}
        />
      </Screen>
    );
  }

  const rows = listQuery.data ?? [];
  if (rows.length === 0) {
    return (
      <Screen padded>
        <EmptyState title="No conversations yet" message="Ask Staynex AI anything to start one." />
      </Screen>
    );
  }

  function confirmDelete(row: AgentConversation) {
    Alert.alert("Delete conversation?", "This removes it from your history.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(row.id) },
    ]);
  }

  return (
    <Screen>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        contentContainerStyle={styles.listContent}
        refreshing={listQuery.isRefetching}
        onRefresh={() => listQuery.refetch()}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.replace({ pathname: "/(tabs)/assistant", params: { open: item.id } })
            }
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.rowMain}>
              <Text style={styles.title} numberOfLines={1}>
                {item.pinned ? "📌 " : ""}
                {item.title ?? item.preview ?? "New conversation"}
              </Text>
              {item.preview ? (
                <Text style={styles.preview} numberOfLines={1}>
                  {item.preview}
                </Text>
              ) : null}
              <Text style={styles.time}>{new Date(item.updatedAt).toLocaleString()}</Text>
            </View>
            <View style={styles.rowActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => pinMutation.mutate({ id: item.id, pinned: !item.pinned })}
              >
                <Text style={styles.action}>{item.pinned ? "Unpin" : "Pin"}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setRenaming(item);
                  setRenameTitle(item.title ?? "");
                }}
              >
                <Text style={styles.action}>Rename</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => confirmDelete(item)}>
                <Text style={[styles.action, styles.actionDanger]}>Delete</Text>
              </Pressable>
            </View>
          </Pressable>
        )}
      />

      <Modal visible={Boolean(renaming)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rename conversation</Text>
            <TextInput
              style={styles.modalInput}
              value={renameTitle}
              onChangeText={setRenameTitle}
              placeholder="Conversation title"
              placeholderTextColor={color.muted}
              maxLength={120}
              autoFocus
            />
            {renameMutation.isError ? (
              <Text style={styles.modalError}>
                {apiErrorMessage(renameMutation.error, "Couldn't rename.")}
              </Text>
            ) : null}
            <View style={styles.modalActions}>
              <Button label="Cancel" variant="secondary" onPress={() => setRenaming(null)} />
              <Button
                label="Save"
                loading={renameMutation.isPending}
                disabled={!renameTitle.trim()}
                onPress={() =>
                  renaming && renameMutation.mutate({ id: renaming.id, title: renameTitle.trim() })
                }
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: spacing.lg, gap: spacing.sm },
  row: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  pressed: { opacity: 0.85 },
  rowMain: { gap: 2 },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: color.ink },
  preview: { fontSize: fontSize.sm, color: color.muted },
  time: { fontSize: fontSize.xs, color: color.muted },
  rowActions: { flexDirection: "row", gap: spacing.lg },
  action: { color: color.primary, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  actionDanger: { color: color.error },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16,16,20,0.45)",
    justifyContent: "center",
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: color.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: color.ink },
  modalInput: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: color.ink,
    backgroundColor: color.surface,
  },
  modalError: { fontSize: fontSize.sm, color: color.error },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.md },
});
