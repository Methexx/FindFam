exports.up = (pgm) => {
  pgm.createTable('circles', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'text', notNull: true },
    owner_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    deleted_at: { type: 'timestamptz' },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('circles');
};
