import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  StreamableFile,
} from "@nestjs/common";
import type { VoucherVerification } from "../../../types";
import { RateLimit } from "../../common/rate-limit.guard";
import { VoucherService } from "./voucher.service";

/**
 * Public voucher surface. All three routes key on the payment reference (an
 * unguessable capability token), so no session is required — the same booking
 * proof works for anonymous guests and for a receptionist scanning the QR.
 */
@Controller()
export class VoucherController {
  constructor(private readonly vouchers: VoucherService) {}

  /** Live verification card the QR points to — the trust anchor for check-in. */
  @Get("verify/:reference")
  @RateLimit({ bucket: "voucher:verify", limit: 60, windowMs: 60_000, keyBy: ["ip"] })
  verify(@Param("reference") reference: string): Promise<VoucherVerification> {
    return this.vouchers.getVerification(reference);
  }

  /** The canonical PDF — the exact bytes also attached to the confirmation email. */
  @Get("vouchers/:reference/pdf")
  @RateLimit({ bucket: "voucher:pdf", limit: 30, windowMs: 60_000, keyBy: ["ip"] })
  async pdf(@Param("reference") reference: string): Promise<StreamableFile> {
    const result = await this.vouchers.renderPdf(reference);
    if (!result) throw new NotFoundException("No receipt is available for this reference");
    return new StreamableFile(result.buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="${result.filename}"`,
    });
  }

  /** SVG QR for the on-page voucher (same target as the PDF's embedded QR). */
  @Get("vouchers/:reference/qr.svg")
  @Header("Content-Type", "image/svg+xml")
  @Header("Cache-Control", "public, max-age=3600")
  @RateLimit({ bucket: "voucher:qr", limit: 60, windowMs: 60_000, keyBy: ["ip"] })
  qr(@Param("reference") reference: string): Promise<string> {
    return this.vouchers.qrSvg(reference);
  }
}
