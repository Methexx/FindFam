export interface Circle {
  id: string;
  name: string;
  ownerId: string;
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
