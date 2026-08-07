import * as emergencyContactsRepository from './emergency-contacts.repository';
import * as authRepository from '../auth/auth.repository';
import * as followsRepository from '../follows/follows.repository';

export class EmergencyContactError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
  }
}

function toPublicContact(row: emergencyContactsRepository.EmergencyContactWithUsername) {
  return {
    id: row.id,
    userId: row.user_id,
    contactUserId: row.contact_user_id,
    username: row.username,
    phone: row.phone,
    priority: row.priority,
  };
}

export async function addContact(
  userId: string,
  input: { username: string; phone?: string; priority?: number },
) {
  const target = await authRepository.findUserByUsername(input.username);
  if (!target) {
    throw new EmergencyContactError('User not found', 404);
  }

  if (target.id === userId) {
    throw new EmergencyContactError('You cannot add yourself as an emergency contact', 400);
  }

  const accepted = await followsRepository.findAcceptedFollowBetween(userId, target.id);
  if (!accepted) {
    throw new EmergencyContactError(
      'You and this user must be mutually followed before they can be added as an emergency contact',
      403,
    );
  }

  const existing = await emergencyContactsRepository.findContact(userId, target.id);
  if (existing) {
    throw new EmergencyContactError('This user is already an emergency contact', 409);
  }

  await emergencyContactsRepository.insertContact({
    userId,
    contactUserId: target.id,
    phone: input.phone ?? null,
    priority: input.priority ?? 1,
  });

  const [contact] = await emergencyContactsRepository.listContactsForUser(userId).then((rows) =>
    rows.filter((row) => row.contact_user_id === target.id),
  );
  return toPublicContact(contact!);
}

export async function listContacts(userId: string) {
  const rows = await emergencyContactsRepository.listContactsForUser(userId);
  return rows.map(toPublicContact);
}

export async function updateContactPriority(userId: string, id: string, priority: number) {
  const updated = await emergencyContactsRepository.updateContactPriority(userId, id, priority);
  if (!updated) {
    throw new EmergencyContactError('Emergency contact not found', 404);
  }
  const [contact] = await emergencyContactsRepository
    .listContactsForUser(userId)
    .then((rows) => rows.filter((row) => row.id === id));
  return toPublicContact(contact!);
}

export async function removeContact(userId: string, id: string) {
  // Idempotent delete — no pre-existence check, consistent with
  // circles.service.removeMember / follows.repository.deleteFollow.
  await emergencyContactsRepository.deleteContact(userId, id);
}
