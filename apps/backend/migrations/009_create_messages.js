exports.up = (pgm) => {
  pgm.createTable('messages', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    circle_id: {
      type: 'uuid',
      notNull: true,
      references: 'circles',
      onDelete: 'CASCADE',
    },
    sender_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    content: { type: 'text', notNull: true },
    sent_at: { type: 'timestamptz', notNull: true },
  });

  pgm.createIndex('messages', ['circle_id', { name: 'sent_at', sort: 'DESC' }], {
    name: 'messages_circle_id_sent_at_idx',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('messages');
};
