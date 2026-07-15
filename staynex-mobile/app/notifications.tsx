import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationRow } from "@staynex/backend/types";
import { color, fontSize, fontWeight, radius, spacing } from "@staynex/shared";
import { notificationsApi } from "@/data/api";
import { apiErrorMessage } from "@/core/client";
import { routeForPushLink } from "@/core/push";
import { useSession } from "@/core/session";
import { Screen } from "@/ui/Screen";
import { Button } from "@/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "@/ui/states";

export default function NotificationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, status } = useSession();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [older, setOlder] = useState<NotificationRow[]>([]);

  const pageQuery = useQuery({
    queryKey: ["notifications", user?.id, cursor ?? "first"],
    queryFn: () => notificationsApi.list(cursor),
    enabled: Boolean(user),
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const openMutation = useMutation({
    mutationFn: (row: NotificationRow) =>
      row.readAt ? Promise.resolve({ updated: 0 }) : notificationsApi.markRead([row.id]),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  if (status !== "ready" || (user && pageQuery.isLoading && older.length === 0)) {
    return (
      <Screen padded>
        <LoadingState label="Loading notifications…" />
      </Screen>
    );
  }
  if (!user) {
    return (
      <Screen padded>
        <EmptyState title="Sign in first" message="Notifications live behind sign-in." />
      </Screen>
    );
  }
  if (pageQuery.isError) {
    return (
      <Screen padded>
        <ErrorState
          message={apiErrorMessage(pageQuery.error, "Couldn't load notifications.")}
          onRetry={() => pageQuery.refetch()}
        />
      </Screen>
    );
  }

  const page = pageQuery.data;
  const rows = [...older, ...(page?.rows ?? [])];

  function open(row: NotificationRow) {
    openMutation.mutate(row);
    const target = routeForPushLink(row.linkUrl ?? undefined);
    if (target.pathname !== "/notifications") {
      router.push({ pathname: target.pathname as never, params: target.params });
    }
  }

  if (rows.length === 0) {
    return (
      <Screen padded>
        <EmptyState
          title="Nothing here yet"
          message="Booking confirmations and trip reminders will land here."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        contentContainerStyle={styles.listContent}
        refreshing={pageQuery.isRefetching}
        onRefresh={() => {
          setOlder([]);
          setCursor(undefined);
          void pageQuery.refetch();
        }}
        ListHeaderComponent={
          (page?.unreadCount ?? 0) > 0 ? (
            <View style={styles.header}>
              <Text style={styles.unread}>
                {page?.unreadCount} unread
              </Text>
              <Button
                label="Mark all read"
                variant="secondary"
                loading={markAllMutation.isPending}
                onPress={() => markAllMutation.mutate()}
              />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => open(item)}
            style={({ pressed }) => [
              styles.row,
              !item.readAt && styles.rowUnread,
              pressed && styles.rowPressed,
            ]}
          >
            <View style={styles.rowHead}>
              {!item.readAt ? <View style={styles.dot} /> : null}
              <Text style={[styles.title, !item.readAt && styles.titleUnread]} numberOfLines={1}>
                {item.title}
              </Text>
            </View>
            <Text style={styles.body} numberOfLines={2}>
              {item.body}
            </Text>
            <Text style={styles.time}>{new Date(item.createdAt).toLocaleString()}</Text>
          </Pressable>
        )}
        ListFooterComponent={
          page?.nextCursor ? (
            <View style={styles.footer}>
              <Button
                label="Load older"
                variant="secondary"
                onPress={() => {
                  setOlder(rows);
                  setCursor(page.nextCursor ?? undefined);
                }}
              />
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: spacing.lg, gap: spacing.sm },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  unread: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: color.primary },
  row: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.lg,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  rowUnread: { borderColor: color.primary },
  rowPressed: { opacity: 0.85 },
  rowHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.primary },
  title: { fontSize: fontSize.md, color: color.ink, flexShrink: 1 },
  titleUnread: { fontWeight: fontWeight.semibold },
  body: { fontSize: fontSize.sm, color: color.muted },
  time: { fontSize: fontSize.xs, color: color.muted },
  footer: { paddingVertical: spacing.md },
});
