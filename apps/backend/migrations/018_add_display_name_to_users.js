// A separate, optional field from `username` (which stays the unique,
// immutable-by-default handle) — falls back to username for display when
// unset, same nullable-string pattern as avatar_url.
exports.up = (pgm) => {
  pgm.addColumn('users', {
    display_name: { type: 'text' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('users', 'display_name');
};
