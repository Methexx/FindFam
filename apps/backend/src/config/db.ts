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
  fcm_token: string | null;
  suspended_at: Date | null;
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
  invite_code: string;
  created_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface CircleMembersTable {
  circle_id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: Generated<Date>;
}

export interface LocationsTable {
  id: Generated<string>;
  user_id: string;
  // geography(Point, 4326) — no native Kysely type; written/read via raw SQL
  // (ST_MakePoint on insert, ST_X/ST_Y on select) rather than modeled here.
  geom: string;
  speed: number | null;
  battery_level: number | null;
  recorded_at: Date;
}

export interface MessagesTable {
  id: Generated<string>;
  circle_id: string;
  sender_id: string;
  content: string;
  sent_at: Date;
}

export interface EmergencyContactsTable {
  id: Generated<string>;
  user_id: string;
  contact_user_id: string;
  phone: string | null;
  priority: Generated<number>;
}

export interface SosEventsTable {
  id: Generated<string>;
  user_id: string;
  // geography(Point, 4326) — no native Kysely type; written/read via raw SQL
  // (ST_MakePoint on insert, ST_X/ST_Y on select) rather than modeled here.
  origin: string;
  status: 'active' | 'resolved' | 'cancelled';
  triggered_at: Date;
  resolved_at: Date | null;
}

export interface GeofencesTable {
  id: Generated<string>;
  circle_id: string;
  name: string;
  // geography(Point, 4326) — no native Kysely type; written/read via raw SQL
  // (ST_MakePoint on insert, ST_X/ST_Y on select) rather than modeled here.
  center: string;
  radius_meters: number;
  created_by: string;
}

export interface AdminAuditLogTable {
  id: Generated<string>;
  admin_id: string;
  action: string;
  target_user_id: string;
  created_at: Generated<Date>;
}

export interface Database {
  users: UsersTable;
  admins: AdminsTable;
  refresh_tokens: RefreshTokensTable;
  follows: FollowsTable;
  circles: CirclesTable;
  circle_members: CircleMembersTable;
  locations: LocationsTable;
  messages: MessagesTable;
  emergency_contacts: EmergencyContactsTable;
  sos_events: SosEventsTable;
  geofences: GeofencesTable;
  admin_audit_log: AdminAuditLogTable;
}

// Supabase requires SSL on both its pooled and direct connections; local
// Docker Postgres doesn't use SSL at all. Rather than a dedicated env var,
// key off the host — anything not on localhost is assumed to need it.
// rejectUnauthorized: false because Supabase's certs aren't in Node's
// default trust store by default; the connection is still encrypted, just
// not verified against a CA — acceptable here since the connection string
// itself is the real secret being protected.
const isLocalDatabase = ['localhost', '127.0.0.1'].includes(
  new URL(env.DATABASE_URL).hostname,
);

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: isLocalDatabase ? false : { rejectUnauthorized: false },
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});
