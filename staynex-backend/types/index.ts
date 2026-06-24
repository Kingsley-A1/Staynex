export * from "./api";

export type UserRole = "GUEST" | "OWNER" | "ADMIN";

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}
