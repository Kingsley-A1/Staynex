import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { color, fontSize, fontWeight, spacing } from "@staynex/shared";
import { authApi } from "@/data/api";
import { apiErrorMessage } from "@/core/client";
import { useSession } from "@/core/session";
import { Screen } from "@/ui/Screen";
import { Button } from "@/ui/Button";
import { Field, TextField } from "@/ui/form";
import { EmptyState } from "@/ui/states";

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, setUser } = useSession();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");

  const mutation = useMutation({
    mutationFn: () =>
      authApi.updateProfile({
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        // An emptied phone field clears the stored number (backend accepts null).
        phone: phone.trim() || null,
      }),
    onSuccess: (updated) => {
      setUser(updated);
      router.back();
    },
  });

  if (!user) {
    return (
      <Screen padded>
        <EmptyState title="Sign in first" message="Your profile lives behind sign-in." />
      </Screen>
    );
  }

  const canSave = email.trim().length > 3;

  return (
    <Screen padded>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          <Field label="Name">
            <TextField
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
            />
          </Field>
          <Field label="Email" hint="Changing this changes where receipts are sent.">
            <TextField
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
            />
          </Field>
          <Field label="Phone">
            <TextField
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. 08030000000"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
            />
          </Field>

          {mutation.isError ? (
            <Text style={styles.error}>
              {apiErrorMessage(mutation.error, "Couldn't save your profile.")}
            </Text>
          ) : null}

          <Button
            label="Save changes"
            onPress={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!canSave}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { gap: spacing.md, paddingTop: spacing.lg },
  error: { fontSize: fontSize.sm, color: color.error },
});
