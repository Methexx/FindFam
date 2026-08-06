import { db } from '../src/config/db';
import { hashPassword } from '../src/lib/password';

function readArg(flag: string): string | undefined {
  const prefix = `--${flag}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg?.slice(prefix.length);
}

async function main() {
  const email = readArg('email') ?? process.env.ADMIN_SEED_EMAIL;
  const password = readArg('password') ?? process.env.ADMIN_SEED_PASSWORD;

  if (!email || !password) {
    console.error(
      'Usage: npm run seed:admin -- --email=admin@example.com --password=changeme\n' +
        '(or set ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD in the environment)',
    );
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const result = await db
    .insertInto('admins')
    .values({ email, password_hash: passwordHash })
    .onConflict((oc) => oc.column('email').doNothing())
    .returningAll()
    .executeTakeFirst();

  if (result) {
    console.log(`Admin seeded: ${result.email}`);
  } else {
    console.log(`Admin with email ${email} already exists — no changes made.`);
  }

  await db.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
