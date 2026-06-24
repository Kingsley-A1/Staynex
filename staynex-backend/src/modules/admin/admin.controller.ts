import { Body, Controller, Get, Headers, Param, Post } from "@nestjs/common";
import { parseBody, requiredHeader } from "../../common/http";
import { AdminService } from "./admin.service";
import { approvalActionSchema } from "./dto";

// `x-user-id` stands in for the authenticated admin until AuthModule lands.
@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("approvals")
  queue() {
    return this.admin.approvalQueue();
  }

  @Get("approvals/:id")
  review(@Param("id") id: string) {
    return this.admin.getForReview(id);
  }

  @Post("approvals/:id/decision")
  decide(
    @Headers("x-user-id") adminUserId: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.admin.review(
      requiredHeader(adminUserId, "x-user-id"),
      id,
      parseBody(approvalActionSchema, body),
    );
  }
}
