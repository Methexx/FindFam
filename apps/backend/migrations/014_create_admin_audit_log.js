exports.up = (pgm) => {
  pgm.createTable('admin_audit_log', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    admin_id: {
      type: 'uuid',
      notNull: true,
      references: 'admins',
      onDelete: 'CASCADE',
    },
    action: { type: 'text', notNull: true },
    target_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('admin_audit_log', 'target_user_id', {
    name: 'admin_audit_log_target_user_id_idx',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('admin_audit_log');
};
