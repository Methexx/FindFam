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
  role: 'owner' | 'member';
  joinedAt: string;
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
