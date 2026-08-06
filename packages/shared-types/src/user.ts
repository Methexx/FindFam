export interface User {
  id: string;
  username: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  isSharing: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface Follow {
  id: string;
  followerId: string;
  followeeId: string;
  status: 'pending' | 'accepted' | 'blocked';
  createdAt: string;
}

export interface Admin {
  id: string;
  email: string;
  createdAt: string;
}
