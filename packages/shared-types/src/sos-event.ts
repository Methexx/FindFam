import type { GeoPoint } from './circle';

export interface SosEvent {
  id: string;
  userId: string;
  origin: GeoPoint;
  status: 'active' | 'resolved' | 'cancelled';
  triggeredAt: string;
  resolvedAt: string | null;
}

export interface AdminSosEvent extends SosEvent {
  username: string;
}
