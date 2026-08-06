exports.up = (pgm) => {
  pgm.createTable(
    'circle_members',
    {
      circle_id: {
        type: 'uuid',
        notNull: true,
        references: 'circles',
        onDelete: 'CASCADE',
      },
      user_id: {
        type: 'uuid',
        notNull: true,
        references: 'users',
        onDelete: 'CASCADE',
      },
      role: { type: 'text', notNull: true },
      joined_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    },
    {
      constraints: {
        primaryKey: ['circle_id', 'user_id'],
      },
    },
  );
};

exports.down = (pgm) => {
  pgm.dropTable('circle_members');
};
