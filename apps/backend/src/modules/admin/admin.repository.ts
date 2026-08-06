import { db } from '../../config/db';

export function findAdminByEmail(email: string) {
  return db.selectFrom('admins').selectAll().where('email', '=', email).executeTakeFirst();
}
