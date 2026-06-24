export * from "./api";

export type UserRole = "GUEST" | "OWNER" | "ADMIN_REVIEWER" | "ADMIN_MANAGER";

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}
