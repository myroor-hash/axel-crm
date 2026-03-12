export type UserRole = "admin" | "sales";

export interface AuthUser {
  id: string;
  authUserId: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

