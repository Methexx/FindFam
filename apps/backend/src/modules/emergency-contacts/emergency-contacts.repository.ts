import { db } from '../../config/db';

export interface EmergencyContactWithUsername {
  id: string;
  user_id: string;
  contact_user_id: string;
  phone: string | null;
  priority: number;
  username: string;
}

export function listContactsForUser(userId: string): Promise<EmergencyContactWithUsername[]> {
  return db
    .selectFrom('emergency_contacts')
    .innerJoin('users', 'users.id', 'emergency_contacts.contact_user_id')
    .select([
      'emergency_contacts.id',
      'emergency_contacts.user_id',
      'emergency_contacts.contact_user_id',
      'emergency_contacts.phone',
      'emergency_contacts.priority',
      'users.username',
    ])
    .where('emergency_contacts.user_id', '=', userId)
    .orderBy('emergency_contacts.priority', 'asc')
    .execute();
}

export function findContact(userId: string, contactUserId: string) {
  return db
    .selectFrom('emergency_contacts')
    .selectAll()
    .where('user_id', '=', userId)
    .where('contact_user_id', '=', contactUserId)
    .executeTakeFirst();
}

export function findContactById(userId: string, id: string) {
  return db
    .selectFrom('emergency_contacts')
    .selectAll()
    .where('id', '=', id)
    .where('user_id', '=', userId)
    .executeTakeFirst();
}

export function insertContact(input: {
  userId: string;
  contactUserId: string;
  phone: string | null;
  priority: number;
}) {
  return db
    .insertInto('emergency_contacts')
    .values({
      user_id: input.userId,
      contact_user_id: input.contactUserId,
      phone: input.phone,
      priority: input.priority,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function updateContactPriority(userId: string, id: string, priority: number) {
  return db
    .updateTable('emergency_contacts')
    .set({ priority })
    .where('id', '=', id)
    .where('user_id', '=', userId)
    .returningAll()
    .executeTakeFirst();
}

export function deleteContact(userId: string, id: string) {
  return db
    .deleteFrom('emergency_contacts')
    .where('id', '=', id)
    .where('user_id', '=', userId)
    .execute();
}
