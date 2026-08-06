import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export async function signToken(
  payload: JWTPayload,
  secret: string,
  expiresIn: string,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(secret));
}

export async function verifyToken<T extends JWTPayload>(
  token: string,
  secret: string,
): Promise<T> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
  return payload as T;
}
