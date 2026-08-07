exports.up = (pgm) => {
  pgm.createTable('sos_events', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    origin: {
      type: 'geography(Point, 4326)',
      notNull: true,
    },
    status: { type: 'text', notNull: true },
    triggered_at: { type: 'timestamptz', notNull: true },
    resolved_at: { type: 'timestamptz' },
  });

  pgm.createIndex('sos_events', 'status', { name: 'sos_events_status_idx' });
  pgm.createIndex('sos_events', ['user_id', { name: 'triggered_at', sort: 'DESC' }], {
    name: 'sos_events_user_id_triggered_at_idx',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('sos_events');
};
