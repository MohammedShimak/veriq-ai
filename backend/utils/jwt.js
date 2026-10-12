import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret_lexagent_key_321";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "30d";

/**
 * Generates an Access Token for a user.
 * @param {string} userId 
 * @param {string} role 
 * @returns {string} Signed JWT Access Token
 */
export function generateAccessToken(userId, role = "user") {
  return jwt.sign({ userId, role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
}

/**
 * Generates a Refresh Token for a user.
 * @param {string} userId 
 * @returns {string} Signed JWT Refresh Token
 */
export function generateRefreshToken(userId) {
  return jwt.sign({ userId, type: "refresh" }, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN
  });
}

/**
 * Verifies a JWT token.
 * @param {string} token 
 * @returns {object} Decoded payload
 */
export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}
