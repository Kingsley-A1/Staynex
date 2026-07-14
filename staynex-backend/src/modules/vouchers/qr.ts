import QRCode from "qrcode";

// Error-correction level M tolerates ~15% occlusion — enough for a phone screen
// with a fingerprint on it, without bloating the module count. margin:1 keeps a
// tight quiet zone so the code stays legible when printed small on the voucher.
const BASE_OPTIONS = { margin: 1, errorCorrectionLevel: "M" } as const;

/** SVG markup for the on-page voucher (crisp at any size, no raster blur). */
export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { ...BASE_OPTIONS, type: "svg", width: 240 });
}

/** PNG data URL for embedding in the PDF via react-pdf's <Image>. */
export function qrPngDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { ...BASE_OPTIONS, width: 320 });
}
