exports.up = (pgm) => {
  pgm.sql('CREATE EXTENSION IF NOT EXISTS postgis;');
};

exports.down = (pgm) => {
  pgm.sql('DROP EXTENSION IF EXISTS postgis;');
};
