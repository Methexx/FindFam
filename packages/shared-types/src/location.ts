import type { GeoPoint } from './circle';

export interface LocationUpdate {
  id: number;
  userId: string;
  geom: GeoPoint;
  speed: number | null;
  batteryLevel: number | null;
  recordedAt: string;
}
