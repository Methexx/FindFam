import { db, type UsersTable } from '../../config/db';

export function findUserByUsernameOrEmail(usernameOrEmail: string) {
  return db
    .selectFrom('users')
    .selectAll()
    .where((eb) =>
      eb.or([
        eb('email', '=', usernameOrEmail),
        eb(eb.fn('lower', ['username']), '=', usernameOrEmail.toLowerCase()),
      ]),
    )
    .executeTakeFirst();
}

export function findUserById(id: string) {
  return db.selectFrom('users').selectAll().where('id', '=', id).executeTakeFirst();
}

export async function findFcmTokenForUser(userId: string) {
  const row = await db
    .selectFrom('users')
    .select('fcm_token')
    .where('id', '=', userId)
    .executeTakeFirst();
  return row?.fcm_token ?? null;
}

export function findUserByUsername(username: string) {
  return db
    .selectFrom('users')
    .selectAll()
    .where((eb) => eb(eb.fn('lower', ['username']), '=', username.toLowerCase()))
    .executeTakeFirst();
}

export function createUser(input: {
  username: string;
  email: string;
  phone: string | null;
  passwordHash: string;
}) {
  return db
    .insertInto('users')
    .values({
      username: input.username,
      email: input.email,
      phone: input.phone,
      password_hash: input.passwordHash,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function updateUser(
  id: string,
  input: Partial<Pick<UsersTable, 'avatar_url' | 'phone'>>,
) {
  return db
    .updateTable('users')
    .set({ ...input, updated_at: new Date() })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function updateSharingStatus(id: string, isSharing: boolean) {
  return db
    .updateTable('users')
    .set({ is_sharing: isSharing, updated_at: new Date() })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function createRefreshToken(userId: string, tokenHash: string, expiresAt: Date) {
  return db
    .insertInto('refresh_tokens')
    .values({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt })
    .execute();
}

export function findRefreshTokenByHash(tokenHash: string) {
  return db
    .selectFrom('refresh_tokens')
    .selectAll()
    .where('token_hash', '=', tokenHash)
    .executeTakeFirst();
}

export function deleteRefreshTokenByHash(tokenHash: string) {
  return db.deleteFrom('refresh_tokens').where('token_hash', '=', tokenHash).execute();
}

export function deleteRefreshTokensForUser(userId: string) {
  return db.deleteFrom('refresh_tokens').where('user_id', '=', userId).execute();
}
