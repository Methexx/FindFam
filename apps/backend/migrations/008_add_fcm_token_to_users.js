exports.up = (pgm) => {
  pgm.addColumn('users', {
    fcm_token: { type: 'text' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('users', 'fcm_token');
};
