import { db } from '../src/config/db';

export async function truncateAll() {
  await db.deleteFrom('refresh_tokens').execute();
  await db.deleteFrom('users').execute();
  await db.deleteFrom('admins').execute();
}
