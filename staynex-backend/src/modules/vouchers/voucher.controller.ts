import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import type { AuthUser, VoucherVerification } from "../../../types";
import { RateLimit } from "../../common/rate-limit.guard";
import { CurrentUser, SessionGuard } from "../auth/access-control";
import { VoucherService } from "./voucher.service";

/** Public verification is minimal; private voucher artifacts require ownership. */
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
  @UseGuards(SessionGuard)
  @Header("Cache-Control", "private, no-store")
  @RateLimit({ bucket: "voucher:pdf", limit: 30, windowMs: 60_000, keyBy: ["ip"] })
  async pdf(
    @CurrentUser() user: AuthUser,
    @Param("reference") reference: string,
  ): Promise<StreamableFile> {
    const result = await this.vouchers.renderPdfForUser(reference, user.id);
    if (!result) throw new NotFoundException("No receipt is available for this reference");
    return new StreamableFile(result.buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="${result.filename}"`,
    });
  }

  /** SVG QR for the on-page voucher (same target as the PDF's embedded QR). */
  @Get("vouchers/:reference/qr.svg")
  @UseGuards(SessionGuard)
  @Header("Content-Type", "image/svg+xml")
  @Header("Cache-Control", "private, no-store")
  @RateLimit({ bucket: "voucher:qr", limit: 60, windowMs: 60_000, keyBy: ["ip"] })
  async qr(
    @CurrentUser() user: AuthUser,
    @Param("reference") reference: string,
  ): Promise<string> {
    const result = await this.vouchers.qrSvgForUser(reference, user.id);
    if (!result) throw new NotFoundException("No voucher is available for this reference");
    return result;
  }
}
