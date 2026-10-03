export type OrganizationRole = "ADMIN" | "MANAGER" | "MEMBER";

export interface AuthContext {
  currentUserId: string;
  currentOrganizationId: string;
}
