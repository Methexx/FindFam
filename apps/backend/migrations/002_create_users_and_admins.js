exports.up = (pgm) => {
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    username: { type: 'text', notNull: true },
    email: { type: 'text', notNull: true },
    phone: { type: 'text' },
    password_hash: { type: 'text', notNull: true },
    avatar_url: { type: 'text' },
    is_sharing: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz' },
  });

  pgm.sql(
    'CREATE UNIQUE INDEX users_username_lower_idx ON users (lower(username));',
  );
  pgm.createIndex('users', 'email', { unique: true, name: 'users_email_idx' });

  pgm.createTable('admins', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    email: { type: 'text', notNull: true, unique: true },
    password_hash: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('admins');
  pgm.dropTable('users');
};
