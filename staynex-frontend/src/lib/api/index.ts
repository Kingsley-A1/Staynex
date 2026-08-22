// Barrel for the Staynex API client.
//
// `@/lib/api` stays the single import site for every caller, so splitting this
// module into per-domain files did not touch a single call site. Add a new
// endpoint to the domain module it belongs to, not to a new top-level file.

export { ApiError, apiErrorMessage } from "./client";
export { hostApi, hostApiSettings } from "./host";
export { adminApi, adminUsersApi, adminListQueryString } from "./admin";
export type { AdminListQuery } from "./admin";
export { authApi, settingsApi } from "./auth";
export { catalogApi, reviewsApi, areasApi, guestApi } from "./catalog";
export { AssistantTransportError, agentApi } from "./assistant";
export type {
  AgentStreamMeta,
  AssistantOperation,
  AssistantRequest,
} from "./assistant";
export { notificationsApi } from "./notifications";
export { uploadToTarget } from "./media";
