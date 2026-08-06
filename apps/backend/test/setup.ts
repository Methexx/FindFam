import { db } from '../src/config/db';

export async function truncateAll() {
  await db.deleteFrom('circle_members').execute();
  await db.deleteFrom('circles').execute();
  await db.deleteFrom('follows').execute();
  await db.deleteFrom('refresh_tokens').execute();
  await db.deleteFrom('users').execute();
  await db.deleteFrom('admins').execute();
}
