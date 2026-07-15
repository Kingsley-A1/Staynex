import { Controller, Get } from "@nestjs/common";
import { getSupportContactFromEnv } from "../../common/support-contact";

@Controller("support")
export class SupportController {
  @Get("contact")
  contact() {
    return getSupportContactFromEnv();
  }
}
