import {
  Document,
  Image,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { VoucherData } from "./voucher.types";

// Brand palette mirrors the web/email theme so the PDF, the confirmation page,
// and the confirmation email read as one artifact.
const C = {
  primary: "#27187D",
  ink: "#101014",
  muted: "#6E6A83",
  border: "#E7E5F2",
  tint: "#F7F7FF",
  successFg: "#0B7A4B",
  successBg: "#E6F4EC",
  warnFg: "#9A5B00",
  warnBg: "#FBF0DF",
} as const;

const styles = StyleSheet.create({
  page: {
    paddingVertical: 36,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: C.ink,
    lineHeight: 1.4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  brand: { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.primary, letterSpacing: 1 },
  subtitle: { fontSize: 10, color: C.muted, marginTop: 3 },
  badge: { borderRadius: 4, paddingVertical: 5, paddingHorizontal: 10 },
  badgeText: { fontSize: 9, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  divider: { borderBottomWidth: 1, borderBottomColor: C.border, marginVertical: 16 },
  body: { flexDirection: "row" },
  leftCol: { width: "60%", paddingRight: 18 },
  rightCol: { width: "40%" },
  overline: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.muted,
    letterSpacing: 1,
    marginBottom: 8,
  },
  field: { marginBottom: 11 },
  fieldLabel: { fontSize: 8, color: C.muted, letterSpacing: 0.5, marginBottom: 2 },
  fieldValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.ink },
  fieldSub: { fontSize: 9, color: C.muted, marginTop: 1 },
  qrBox: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    backgroundColor: C.tint,
  },
  qrImage: { width: 132, height: 132 },
  qrHint: { fontSize: 8, color: C.muted, marginTop: 6, textAlign: "center" },
  refLabel: { fontSize: 8, color: C.muted, letterSpacing: 0.5, marginTop: 10 },
  refValue: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.primary, textAlign: "center" },
  receipt: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  amountLabel: { fontSize: 8, color: C.muted, letterSpacing: 1 },
  amount: { fontSize: 20, fontFamily: "Helvetica-Bold", color: C.ink, marginTop: 2 },
  receiptMeta: { alignItems: "flex-end" },
  metaRow: { fontSize: 9, color: C.muted, marginBottom: 2 },
  metaStrong: { color: C.ink, fontFamily: "Helvetica-Bold" },
  footer: { marginTop: "auto", paddingTop: 18 },
  footerStrong: { fontSize: 9, color: C.ink, fontFamily: "Helvetica-Bold" },
  footerText: { fontSize: 8, color: C.muted, marginTop: 4 },
});

function formatMoney(kobo: number, currency: string): string {
  return `${currency} ${Math.round(kobo / 100).toLocaleString("en-NG")}`;
}

/** "Wed, 8 Jul 2026" — parsed as UTC so a date-only string never shifts a day. */
function formatDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/** "paystack" -> "Paystack" for a receipt that reads cleanly. */
function formatProvider(provider: string | null): string {
  if (!provider) return "Card";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function guestsLabel(adults: number, children: number, infants: number): string {
  const parts: string[] = [`${adults} adult${adults === 1 ? "" : "s"}`];
  if (children > 0) parts.push(`${children} child${children === 1 ? "" : "ren"}`);
  if (infants > 0) parts.push(`${infants} infant${infants === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

function addressOf(data: VoucherData): string {
  if (data.addressLine && data.addressLine.trim()) return data.addressLine.trim();
  return [data.areaName, data.cityName].filter(Boolean).join(", ");
}

function Field({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
      {sub ? <Text style={styles.fieldSub}>{sub}</Text> : null}
    </View>
  );
}

function VoucherDoc({ data, qr }: { data: VoucherData; qr: string }) {
  const confirmed = data.paidAndConfirmed;
  const roomSub = data.unitCode
    ? `Unit ${data.unitCode} · assigned at check-in`
    : "Room assigned at check-in";

  return (
    <Document
      title={`Staynex booking ${data.reference}`}
      author="Staynex"
      subject="Booking Confirmation & Receipt"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>STAYNEX</Text>
            <Text style={styles.subtitle}>Booking Confirmation &amp; Receipt</Text>
          </View>
          <View
            style={[
              styles.badge,
              { backgroundColor: confirmed ? C.successBg : C.warnBg },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: confirmed ? C.successFg : C.warnFg },
              ]}
            >
              {confirmed ? "PAID & CONFIRMED" : data.bookingStatus.replace(/_/g, " ")}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.body}>
          <View style={styles.leftCol}>
            <Text style={styles.overline}>STAY DETAILS</Text>
            <Field label="GUEST" value={data.guestName || data.guestEmail || "Guest"} />
            <Field label="PROPERTY" value={data.propertyName} sub={addressOf(data)} />
            <Field label="ROOM" value={data.roomTypeName} sub={roomSub} />
            <View style={{ flexDirection: "row" }}>
              <View style={{ width: "50%" }}>
                <Field label="CHECK-IN" value={formatDate(data.checkIn)} />
              </View>
              <View style={{ width: "50%" }}>
                <Field label="CHECK-OUT" value={formatDate(data.checkOut)} />
              </View>
            </View>
            <View style={{ flexDirection: "row" }}>
              <View style={{ width: "50%" }}>
                <Field
                  label="NIGHTS"
                  value={`${data.nights} night${data.nights === 1 ? "" : "s"}`}
                />
              </View>
              <View style={{ width: "50%" }}>
                <Field
                  label="GUESTS"
                  value={guestsLabel(data.adults, data.children, data.infants)}
                />
              </View>
            </View>
          </View>

          <View style={styles.rightCol}>
            <View style={styles.qrBox}>
              <Image style={styles.qrImage} src={qr} />
              <Text style={styles.qrHint}>Scan to verify this booking on Staynex</Text>
            </View>
            <Text style={styles.refLabel}>BOOKING REFERENCE</Text>
            <Text style={styles.refValue}>{data.reference}</Text>
          </View>
        </View>

        <View style={styles.receipt}>
          <View>
            <Text style={styles.amountLabel}>AMOUNT PAID</Text>
            <Text style={styles.amount}>{formatMoney(data.amountKobo, data.currency)}</Text>
          </View>
          <View style={styles.receiptMeta}>
            <Text style={styles.metaRow}>
              Status: <Text style={styles.metaStrong}>{confirmed ? "Paid in full" : "Pending"}</Text>
            </Text>
            <Text style={styles.metaRow}>
              Method: <Text style={styles.metaStrong}>{formatProvider(data.provider)}</Text>
            </Text>
            <Text style={styles.metaRow}>
              Paid on: <Text style={styles.metaStrong}>{formatDateTime(data.paidAt)}</Text>
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerStrong}>
            Present this confirmation at check-in.
          </Text>
          <Text style={styles.footerText}>
            Your room type is guaranteed. The specific room is assigned by the host on arrival.
            Verify at {data.verifyUrl}
          </Text>
          <Text style={styles.footerText}>
            Questions? support@staynexbookings.ng · Staynex — Book trusted stays, confidently.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

/** Render the canonical voucher PDF to a Buffer (download + email attachment). */
export function renderVoucherPdf(data: VoucherData, qrPngDataUrl: string): Promise<Buffer> {
  return renderToBuffer(<VoucherDoc data={data} qr={qrPngDataUrl} />);
}
