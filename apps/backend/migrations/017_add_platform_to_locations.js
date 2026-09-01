// Which client reported the fix — drives the laptop/phone marker glyph on
// the web map. Nullable: existing rows and not-yet-updated clients are
// valid data, not an error state, so no backfill and no NOT NULL.
exports.up = (pgm) => {
  pgm.addColumn('locations', {
    platform: { type: 'text' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('locations', 'platform');
};
