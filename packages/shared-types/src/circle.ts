export interface Circle {
  id: string;
  name: string;
  ownerId: string;
  /**
   * The code somebody types to join this circle. Only ever populated for
   * the circle's owner — every other member receives `null`, matching the
   * server-side rule that only the owner can bring people in.
   */
  inviteCode: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface CircleMember {
  circleId: string;
  userId: string;
  username: string;
  role: 'owner' | 'member';
  joinedAt: string;
}

export interface CircleWithMembers extends Circle {
  members: CircleMember[];
}

export interface CreateCircleRequest {
  name: string;
}

export interface UpdateCircleRequest {
  name: string;
}

export interface AddCircleMemberRequest {
  username: string;
}

export interface JoinCircleRequest {
  code: string;
}

export interface AdminCircleSummary {
  id: string;
  name: string;
  ownerId: string;
  memberCount: number;
  createdAt: string;
}

export interface Geofence {
  id: string;
  circleId: string;
  name: string;
  center: GeoPoint;
  radiusMeters: number;
  createdBy: string;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}
