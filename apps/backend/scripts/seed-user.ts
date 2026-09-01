import { db } from '../src/config/db';
import { hashPassword } from '../src/lib/password';

function readArg(flag: string): string | undefined {
  const prefix = `--${flag}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg?.slice(prefix.length);
}

async function main() {
  const username = readArg('username') ?? process.env.USER_SEED_USERNAME;
  const email = readArg('email') ?? process.env.USER_SEED_EMAIL;
  const password = readArg('password') ?? process.env.USER_SEED_PASSWORD;
  const phone = readArg('phone') ?? process.env.USER_SEED_PHONE ?? null;

  if (!username || !email || !password) {
    console.error(
      'Usage: npm run seed:user -- --username=testuser --email=user@example.com --password=changeme [--phone=+15555550100]\n' +
        '(or set USER_SEED_USERNAME / USER_SEED_EMAIL / USER_SEED_PASSWORD in the environment)',
    );
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const result = await db
    .insertInto('users')
    .values({ username, email, phone, password_hash: passwordHash })
    .onConflict((oc) => oc.column('email').doNothing())
    .returningAll()
    .executeTakeFirst();

  if (result) {
    console.log(`User seeded: ${result.username} <${result.email}>`);
  } else {
    console.log(`User with email ${email} already exists — no changes made.`);
  }

  await db.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
