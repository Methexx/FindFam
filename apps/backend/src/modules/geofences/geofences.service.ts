import * as geofencesRepository from './geofences.repository';
import * as circlesRepository from '../circles/circles.repository';

export class GeofenceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
  }
}

function toPublicGeofence(row: geofencesRepository.GeofenceRow) {
  return {
    id: row.id,
    circleId: row.circle_id,
    name: row.name,
    center: { lat: row.lat, lng: row.lng },
    radiusMeters: row.radius_meters,
    createdBy: row.created_by,
  };
}

async function requireMembership(userId: string, circleId: string) {
  const circle = await circlesRepository.findCircleById(circleId);
  if (!circle) {
    throw new GeofenceError('Circle not found', 404);
  }
  const membership = await circlesRepository.findMembership(circleId, userId);
  if (!membership) {
    // Same non-disclosure behavior as circles.service — a non-member gets
    // the same "not found" a nonexistent circle would.
    throw new GeofenceError('Circle not found', 404);
  }
  return { circle, membership };
}

export async function createGeofence(
  userId: string,
  circleId: string,
  input: { name: string; center: { lat: number; lng: number }; radiusMeters: number },
) {
  const { membership } = await requireMembership(userId, circleId);
  if (membership.role !== 'owner') {
    throw new GeofenceError('Only the owner can create geofences', 403);
  }

  const row = await geofencesRepository.insertGeofence({
    circleId,
    name: input.name,
    lat: input.center.lat,
    lng: input.center.lng,
    radiusMeters: input.radiusMeters,
    createdBy: userId,
  });

  return toPublicGeofence(row);
}

export async function listGeofences(userId: string, circleId: string) {
  await requireMembership(userId, circleId);
  const rows = await geofencesRepository.listGeofencesForCircle(circleId);
  return rows.map(toPublicGeofence);
}

export async function deleteGeofence(userId: string, geofenceId: string) {
  const geofence = await geofencesRepository.findGeofenceById(geofenceId);
  if (!geofence) {
    throw new GeofenceError('Geofence not found', 404);
  }

  const { membership } = await requireMembership(userId, geofence.circle_id);
  if (membership.role !== 'owner') {
    throw new GeofenceError('Only the owner can delete geofences', 403);
  }

  await geofencesRepository.deleteGeofence(geofenceId);
}
