// @staynex/shared — runtime helpers shared by the Staynex web and mobile clients.
// Zero runtime dependencies; safe to bundle on-device.

export { formatKoboToNGN } from "./money";
export {
  AREA_TYPE_LABELS,
  BOOKING_STATUS_LABELS,
  PAYMENT_STATE_LABELS,
  PAYOUT_METHOD_STATUS_LABELS,
  PAYOUT_STATUS_LABELS,
  PROPERTY_REVIEW_STATUS_LABELS,
  PROPERTY_STATUS_LABELS,
  ROLE_LABELS,
  TESTIMONIAL_STATUS_LABELS,
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
