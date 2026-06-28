// @staynex/shared — runtime helpers shared by the Staynex web and mobile clients.
// Zero runtime dependencies; safe to bundle on-device.

export { formatKoboToNGN } from "./money";
export {
  BOOKING_STATUS_LABELS,
  PAYMENT_STATE_LABELS,
  PAYOUT_STATUS_LABELS,
  BOOKING_STATUS_TONE,
  PAYMENT_STATE_TONE,
  type StatusTone,
} from "./labels";
export {
  color,
  spacing,
  radius,
  fontSize,
  fontWeight,
  tokens,
  type Tokens,
} from "./tokens";
