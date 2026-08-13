exports.up = (pgm) => {
  // geofences.center is queried by ST_DWithin on every location POST
  // (processGeofenceTransitions -> findContainingGeofences), and had no
  // spatial index at all — every update was a seq scan across all
  // geofences.
  pgm.sql('CREATE INDEX geofences_center_gist_idx ON geofences USING GIST (center);');

  pgm.createIndex('circles', 'owner_id', { name: 'circles_owner_id_idx' });
};

exports.down = (pgm) => {
  pgm.dropIndex('circles', 'owner_id', { name: 'circles_owner_id_idx' });
  pgm.sql('DROP INDEX geofences_center_gist_idx;');
};
