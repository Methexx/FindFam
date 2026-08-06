exports.up = (pgm) => {
  pgm.createTable('follows', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    follower_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    followee_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    status: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('follows', ['follower_id', 'followee_id'], { unique: true });
  pgm.createIndex('follows', 'followee_id');
};

exports.down = (pgm) => {
  pgm.dropTable('follows');
};
