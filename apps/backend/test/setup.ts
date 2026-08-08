import { db } from '../src/config/db';

export async function truncateAll() {
  await db.deleteFrom('locations').execute();
  await db.deleteFrom('messages').execute();
  await db.deleteFrom('sos_events').execute();
  await db.deleteFrom('emergency_contacts').execute();
  await db.deleteFrom('geofences').execute();
  await db.deleteFrom('admin_audit_log').execute();
  await db.deleteFrom('circle_members').execute();
  await db.deleteFrom('circles').execute();
  await db.deleteFrom('follows').execute();
  await db.deleteFrom('refresh_tokens').execute();
  await db.deleteFrom('users').execute();
  await db.deleteFrom('admins').execute();
}
