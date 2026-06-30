import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { color, fontSize, fontWeight, spacing } from "@staynex/shared";
import { authApi } from "@/data/api";
import { apiErrorMessage } from "@/core/client";
import { useSession } from "@/core/session";
import { Screen } from "@/ui/Screen";
import { Button } from "@/ui/Button";
import { Field, TextField } from "@/ui/form";

function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function RegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const next = param(params.next);
  const holdId = param(params.holdId);
  const slug = param(params.slug);
  const setUser = useSession((s) => s.setUser);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      authApi.register({
        email: email.trim(),
        password,
        name: name.trim() || undefined,
        role: "GUEST",
      }),
    onSuccess: (user) => {
      setUser(user);
      if (next) router.replace({ pathname: next, params: { holdId, slug } });
      else if (router.canGoBack()) router.back();
      else router.replace("/(tabs)");
    },
  });

  const canSubmit = email.trim().length > 3 && password.length >= 8;

  return (
    <Screen padded>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <View style={styles.container}>
          <Text style={styles.heading}>Create your account</Text>
          <Text style={styles.subheading}>It takes a moment, then you can pay.</Text>

          <Field label="Name" hint="Optional">
            <TextField
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
            />
          </Field>
          <Field label="Email">
            <TextField
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
            />
          </Field>
          <Field label="Password" hint="At least 8 characters">
            <TextField
              value={password}
              onChangeText={setPassword}
              placeholder="Create a password"
              secureTextEntry
              autoComplete="password"
              textContentType="newPassword"
            />
          </Field>

          {mutation.isError ? (
            <Text style={styles.error}>
              {apiErrorMessage(mutation.error, "Couldn't create your account.")}
            </Text>
          ) : null}

          <Button
            label="Create account"
            onPress={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!canSubmit}
          />

          <Link
            href={{ pathname: "/(auth)/login", params: { next, holdId, slug } }}
            replace
            style={styles.link}
          >
            <Text style={styles.linkText}>Already have an account? Sign in</Text>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { gap: spacing.md, paddingTop: spacing.lg },
  heading: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: color.ink },
  subheading: { fontSize: fontSize.sm, color: color.muted, marginBottom: spacing.sm },
  error: { fontSize: fontSize.sm, color: color.error },
  link: { marginTop: spacing.md, alignSelf: "center" },
  linkText: { color: color.primary, fontWeight: fontWeight.medium, fontSize: fontSize.sm },
});
