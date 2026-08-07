exports.up = (pgm) => {
  pgm.createTable(
    'locations',
    {
      id: 'bigserial',
      user_id: {
        type: 'uuid',
        notNull: true,
        references: 'users',
        onDelete: 'CASCADE',
      },
      geom: {
        type: 'geography(Point, 4326)',
        notNull: true,
      },
      speed: { type: 'real' },
      battery_level: { type: 'smallint' },
      recorded_at: { type: 'timestamptz', notNull: true },
    },
    {
      constraints: {
        primaryKey: 'id',
      },
    },
  );

  pgm.sql('CREATE INDEX locations_geom_gist_idx ON locations USING GIST (geom);');
  pgm.createIndex('locations', ['user_id', { name: 'recorded_at', sort: 'DESC' }], {
    name: 'locations_user_id_recorded_at_idx',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('locations');
};
