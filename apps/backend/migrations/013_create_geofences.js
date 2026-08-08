exports.up = (pgm) => {
  pgm.createTable('geofences', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    circle_id: {
      type: 'uuid',
      notNull: true,
      references: 'circles',
      onDelete: 'CASCADE',
    },
    name: { type: 'text', notNull: true },
    center: {
      type: 'geography(Point, 4326)',
      notNull: true,
    },
    radius_meters: { type: 'integer', notNull: true },
    created_by: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
  });

  pgm.createIndex('geofences', 'circle_id', { name: 'geofences_circle_id_idx' });
};

exports.down = (pgm) => {
  pgm.dropTable('geofences');
};
