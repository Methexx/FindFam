// Invite codes are how somebody joins a circle they were told about, rather
// than waiting to be added to one. `circles.addMember` stays owner-only and
// still requires a mutual accepted follow; this is a second, separate path
// in (see circles.service.ts joinCircleByCode for why that isn't a hole).
//
// Alphabet omits I, L, O, 0 and 1 on purpose: a code gets read aloud over
// the phone and typed by hand, so ambiguous glyphs are a real defect, not a
// nicety. 31 symbols ^ 8 characters is ~8.5e11 codes.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

exports.up = (pgm) => {
  // Nullable first: adding NOT NULL before the backfill fails on any
  // circle that already exists.
  pgm.addColumn('circles', {
    invite_code: { type: 'text' },
  });

  // Backfilled row-by-row in plpgsql rather than one UPDATE with a
  // random() subquery — an uncorrelated subquery is evaluated once, which
  // would hand every existing circle the same code and then fail the
  // unique index below. The inner loop retries on the (vanishingly
  // unlikely) collision.
  pgm.sql(`
    DO $$
    DECLARE
      alphabet CONSTANT text := '${CODE_ALPHABET}';
      r RECORD;
      code text;
      i int;
    BEGIN
      FOR r IN SELECT id FROM circles WHERE invite_code IS NULL LOOP
        LOOP
          code := '';
          FOR i IN 1..${CODE_LENGTH} LOOP
            code := code || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
          END LOOP;
          EXIT WHEN NOT EXISTS (SELECT 1 FROM circles WHERE invite_code = code);
        END LOOP;
        UPDATE circles SET invite_code = code WHERE id = r.id;
      END LOOP;
    END $$;
  `);

  pgm.alterColumn('circles', 'invite_code', { notNull: true });

  // Unique because the code is the lookup key for POST /circles/join, and
  // it's what makes the bounded retry in generateInviteCode() correct —
  // the database, not the application, is what guarantees no two circles
  // share a code.
  pgm.createIndex('circles', 'invite_code', {
    name: 'circles_invite_code_key',
    unique: true,
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('circles', 'invite_code', { name: 'circles_invite_code_key' });
  pgm.dropColumn('circles', 'invite_code');
};
