// Lightweight, accessible form controls used across the booking loop. Pure UI —
// they collect user input; they never compute prices, availability, or nights.

import { useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { color, fontSize, fontWeight, radius, spacing } from "@staynex/shared";
import { formatDateLabel, toDateParam } from "@/core/format";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function TextField({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize = "none",
  secureTextEntry,
  autoComplete,
  textContentType,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address";
  autoCapitalize?: "none" | "sentences" | "words";
  secureTextEntry?: boolean;
  autoComplete?: "email" | "password" | "name" | "off";
  textContentType?: "emailAddress" | "password" | "name" | "newPassword";
}) {
  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={color.muted}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      secureTextEntry={secureTextEntry}
      autoComplete={autoComplete}
      textContentType={textContentType}
    />
  );
}

export interface Option {
  label: string;
  value: string;
}

/** Tap-to-open option picker (a modal sheet). Works for city/area selection. */
export function Select({
  value,
  options,
  placeholder = "Select…",
  disabled = false,
  onChange,
}: {
  value: string | null;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) ?? null;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.input, styles.selectRow, disabled && styles.disabled]}
      >
        <Text style={selected ? styles.selectValue : styles.selectPlaceholder} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <FlatList
              data={options}
              keyExtractor={(o) => o.value}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={<Text style={styles.hint}>No options.</Text>}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.optionRow, pressed && styles.optionPressed]}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.optionLabel}>{item.label}</Text>
                  {item.value === value ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/** Integer stepper (e.g. guest count), bounded by [min, max]. */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 20,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <View style={styles.stepper}>
      <StepButton label="−" disabled={value <= min} onPress={() => onChange(value - 1)} />
      <Text style={styles.stepperValue}>{value}</Text>
      <StepButton label="+" disabled={value >= max} onPress={() => onChange(value + 1)} />
    </View>
  );
}

function StepButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.stepBtn, disabled && styles.disabled, pressed && styles.optionPressed]}
    >
      <Text style={styles.stepBtnLabel}>{label}</Text>
    </Pressable>
  );
}

/** Native date picker that emits a `YYYY-MM-DD` string. */
export function DateField({
  value,
  onChange,
  minimumDate,
  placeholder = "Select a date",
}: {
  value: string | null;
  onChange: (value: string) => void;
  minimumDate?: Date;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  const current = value ? new Date(value) : minimumDate ?? new Date();

  function handleChange(event: DateTimePickerEvent, date?: Date) {
    // Android fires once and dismisses itself; iOS stays open until confirmed.
    if (Platform.OS !== "ios") setShow(false);
    if (event.type === "set" && date) onChange(toDateParam(date));
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => setShow(true)}
        style={[styles.input, styles.selectRow]}
      >
        <Text style={value ? styles.selectValue : styles.selectPlaceholder}>
          {value ? formatDateLabel(value) : placeholder}
        </Text>
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>
      {show ? (
        <DateTimePicker
          value={current}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          minimumDate={minimumDate}
          onChange={handleChange}
        />
      ) : null}
      {Platform.OS === "ios" && show ? (
        <Pressable accessibilityRole="button" onPress={() => setShow(false)} style={styles.iosDone}>
          <Text style={styles.iosDoneLabel}>Done</Text>
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: color.ink },
  hint: { fontSize: fontSize.xs, color: color.muted },
  input: {
    minHeight: 48,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: color.ink,
    justifyContent: "center",
  },
  disabled: { opacity: 0.5 },
  selectRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selectValue: { fontSize: fontSize.md, color: color.ink, flexShrink: 1 },
  selectPlaceholder: { fontSize: fontSize.md, color: color.muted, flexShrink: 1 },
  chevron: { fontSize: fontSize.lg, color: color.muted, marginLeft: spacing.sm },
  backdrop: { flex: 1, backgroundColor: "rgba(16,16,20,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    maxHeight: "60%",
  },
  separator: { height: 1, backgroundColor: color.border },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  optionPressed: { opacity: 0.6 },
  optionLabel: { fontSize: fontSize.md, color: color.ink, flexShrink: 1 },
  check: { fontSize: fontSize.md, color: color.primary, fontWeight: fontWeight.bold },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: color.surface,
  },
  stepperValue: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: color.ink, minWidth: 24, textAlign: "center" },
  stepBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  stepBtnLabel: { fontSize: fontSize.xl, color: color.primary, fontWeight: fontWeight.semibold },
  iosDone: { alignSelf: "flex-end", paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  iosDoneLabel: { color: color.primary, fontWeight: fontWeight.semibold, fontSize: fontSize.md },
});
