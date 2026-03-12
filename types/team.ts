export type TeamRole = "admin" | "editor" | "member";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  plan?: "free" | "pro" | "enterprise";
}

export interface TeamMember {
  id: string;
  orgId: string;
  userId: string;
  role: TeamRole;
  email: string;
  name: string;
  avatarUrl?: string;
  joinedAt: string;
  status: "active" | "invited" | "suspended";
}

export interface Invite {
  id: string;
  orgId: string;
  email: string;
  role: TeamRole;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
  accepted: boolean;
}

export const ROLE_PERMISSIONS: Record<TeamRole, string[]> = {
  admin:  ["*"],
  editor: ["connections.view", "queries.run", "queries.edit", "logs.view"],
  member: ["connections.view", "queries.run", "logs.view"],
};

