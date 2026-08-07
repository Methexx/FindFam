exports.up = (pgm) => {
  pgm.createTable('emergency_contacts', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    contact_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    phone: { type: 'text' },
    priority: { type: 'smallint', notNull: true, default: 1 },
  });

  pgm.createIndex('emergency_contacts', 'user_id', {
    name: 'emergency_contacts_user_id_idx',
  });
  pgm.addConstraint('emergency_contacts', 'emergency_contacts_user_contact_unique', {
    unique: ['user_id', 'contact_user_id'],
  });
};

exports.down = (pgm) => {
  pgm.dropTable('emergency_contacts');
};
