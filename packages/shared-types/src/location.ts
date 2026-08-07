export interface LocationUpdate {
  userId: string;
  lat: number;
  lng: number;
  speed: number | null;
  batteryLevel: number | null;
  recordedAt: string;
}

export interface PostLocationRequest {
  lat: number;
  lng: number;
  speed?: number | null;
  batteryLevel?: number | null;
  recordedAt?: string;
}

/** WS client → server, sent once immediately after opening the connection. */
export interface WsAuthMessage {
  type: 'auth';
  token: string;
}

/** WS client → server, at most one accepted per rate-limit window. */
export interface WsLocationUpdateMessage {
  type: 'location:update';
  payload: {
    lat: number;
    lng: number;
    speed?: number | null;
    batteryLevel?: number | null;
  };
}

/** WS server → client, confirms a successful `auth` message. */
export interface WsAuthOkMessage {
  type: 'auth:ok';
}

/** WS server → client, fan-out of a location update to circle members. */
export interface WsLocationBroadcastMessage {
  type: 'location:broadcast';
  payload: LocationUpdate & { circleId: string };
}

export interface WsErrorMessage {
  type: 'error';
  error: string;
}
