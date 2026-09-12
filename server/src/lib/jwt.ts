import jwt, { SignOptions } from "jsonwebtoken";

const JWT_SECRET: string = process.env.JWT_SECRET ?? "dev-only-insecure-secret-change-me";
const JWT_EXPIRES_IN: SignOptions["expiresIn"] = "24h";

/**
 * Payload embedded inside every JWT issued by the API.
 */
export interface JwtUserPayload {
  id: string;
  role: string;
}

/**
 * Signs a JWT for the given user payload. Tokens expire after 24 hours.
 */
export function signToken(payload: JwtUserPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verifies a JWT and returns its payload.
 * Throws (jsonwebtoken errors) when the token is invalid or expired.
 */
export function verifyToken(token: string): JwtUserPayload {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (
    typeof decoded === "string" ||
    decoded === null ||
    typeof (decoded as JwtUserPayload).id !== "string" ||
    typeof (decoded as JwtUserPayload).role !== "string"
  ) {
    throw new Error("Malformed token payload");
  }
  return decoded as JwtUserPayload;
}