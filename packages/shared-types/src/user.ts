export interface User {
  id: string;
  username: string;
  /** Optional, falls back to username for display when unset. */
  displayName: string | null;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  isSharing: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface UpdateProfileRequest {
  username?: string;
  displayName?: string | null;
  phone?: string;
  avatarUrl?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface Follow {
  id: string;
  followerId: string;
  /**
   * Joined from `users` by the follows repository. Null on rows read through
   * a path that does not join — prefer it over `followerId` for display, and
   * fall back rather than showing a raw UUID.
   */
  followerUsername: string | null;
  followeeId: string;
  /** Joined alongside `followerUsername`; same null caveat. */
  followeeUsername: string | null;
  status: 'pending' | 'accepted' | 'blocked';
  createdAt: string;
}

export interface SendFollowRequest {
  followeeUsername: string;
}

export interface RespondFollowRequest {
  action: 'accept' | 'reject';
}

export interface Admin {
  id: string;
  email: string;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  suspended: boolean;
  suspendedAt: string | null;
  createdAt: string;
}

export interface AdminAuditLogEntry {
  id: string;
  adminId: string;
  action: string;
  targetUserId: string;
  createdAt: string;
}
