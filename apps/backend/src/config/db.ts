import { Kysely, PostgresDialect, type Generated } from 'kysely';
import { Pool } from 'pg';
import { env } from './env';

export interface UsersTable {
  id: Generated<string>;
  username: string;
  email: string;
  phone: string | null;
  password_hash: string;
  avatar_url: string | null;
  is_sharing: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Date | null;
}

export interface AdminsTable {
  id: Generated<string>;
  email: string;
  password_hash: string;
  created_at: Generated<Date>;
}

export interface RefreshTokensTable {
  id: Generated<string>;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Generated<Date>;
}

export interface FollowsTable {
  id: Generated<string>;
  follower_id: string;
  followee_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: Generated<Date>;
}

export interface CirclesTable {
  id: Generated<string>;
  name: string;
  owner_id: string;
  created_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface CircleMembersTable {
  circle_id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: Generated<Date>;
}

export interface Database {
  users: UsersTable;
  admins: AdminsTable;
  refresh_tokens: RefreshTokensTable;
  follows: FollowsTable;
  circles: CirclesTable;
  circle_members: CircleMembersTable;
}

const pool = new Pool({ connectionString: env.DATABASE_URL });

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});
