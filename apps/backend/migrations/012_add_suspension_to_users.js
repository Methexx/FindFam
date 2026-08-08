exports.up = (pgm) => {
  pgm.addColumn('users', {
    suspended_at: { type: 'timestamptz' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('users', 'suspended_at');
};
