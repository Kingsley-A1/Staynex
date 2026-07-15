// Scan-to-check-in — points the camera at a guest's booking QR and opens the
// live verify card. The QR encodes the web verify URL (`…/verify/<reference>`),
// so this screen only extracts the reference and lets the server speak; nothing
// about validity is ever decided on-device.
//
// Reception fallback: the reference can be typed/pasted manually (a glare-worn
// printout, a simulator, or a denied camera permission must never block check-in).

import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { color, fontSize, fontWeight, radius, spacing } from "@staynex/shared";
import { Screen } from "@/ui/Screen";
import { Button } from "@/ui/Button";
import { Field, TextField } from "@/ui/form";

/**
 * Pull a payment reference out of whatever the QR carried: the canonical
 * verify URL, a bare path, or the raw `stx_…` token itself.
 */
export function referenceFromScan(raw: string): string | null {
  const match = raw.trim().match(/(?:^|\/verify\/)(stx_[A-Za-z0-9]{8,64})\/?(?:[?#]|$)/);
  return match ? match[1] : null;
}

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualRef, setManualRef] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  // A QR in frame fires onBarcodeScanned repeatedly; only the first hit navigates.
  const handled = useRef(false);

  function openReference(reference: string) {
    if (handled.current) return;
    handled.current = true;
    // `replace` so "back" from the verify card returns here ready for the next
    // guest instead of stacking verify screens during a busy check-in.
    router.replace({ pathname: "/host/verify/[reference]", params: { reference } });
  }

  function onScanned(data: string) {
    const reference = referenceFromScan(data);
    if (reference) {
      setScanError(null);
      openReference(reference);
    } else if (!handled.current) {
      setScanError("That QR isn't a Staynex booking code.");
    }
  }

  function submitManual() {
    const reference = referenceFromScan(manualRef);
    if (reference) openReference(reference);
    else setScanError("Enter the booking reference exactly as printed (it starts with stx_).");
  }

  const cameraReady = permission?.granted === true;

  return (
    <Screen padded>
      <View style={styles.container}>
        {cameraReady ? (
          <View style={styles.cameraWrap}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={({ data }) => onScanned(data)}
            />
            <Text style={styles.cameraHint}>Point the camera at the guest's booking QR.</Text>
          </View>
        ) : (
          <View style={styles.permissionCard}>
            <Text style={styles.permissionTitle}>Camera access</Text>
            <Text style={styles.permissionNote}>
              Staynex uses the camera only to scan booking QR codes at check-in.
            </Text>
            {permission?.canAskAgain !== false ? (
              <Button label="Enable camera" variant="secondary" onPress={() => void requestPermission()} />
            ) : (
              <Text style={styles.permissionNote}>
                Camera is blocked in system settings — use the manual entry below.
              </Text>
            )}
          </View>
        )}

        <Field label="Or enter the reference" hint="Printed on the voucher, e.g. stx_1a2b3c4d…">
          <TextField
            value={manualRef}
            onChangeText={(v) => {
              setManualRef(v);
              setScanError(null);
            }}
            placeholder="stx_…"
            autoCapitalize="none"
          />
        </Field>
        <Button label="Verify booking" onPress={submitManual} disabled={!manualRef.trim()} />

        {scanError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {scanError}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: spacing.lg },
  cameraWrap: { gap: spacing.sm },
  camera: {
    height: 280,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: color.ink,
  },
  cameraHint: { fontSize: fontSize.sm, color: color.muted, textAlign: "center" },
  permissionCard: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  permissionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: color.ink },
  permissionNote: { fontSize: fontSize.sm, color: color.muted },
  error: { fontSize: fontSize.sm, color: color.error },
});
