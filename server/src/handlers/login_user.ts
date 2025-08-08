import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput, type AuthResponse } from '../schema';
import { eq } from 'drizzle-orm';
import { createHmac, timingSafeEqual } from 'crypto';

const JWT_SECRET = process.env['JWT_SECRET'] || 'dev-secret-key';

// Simple password hashing function (for demo - use proper bcrypt in production)
const hashPassword = (password: string, salt: string = 'default-salt'): string => {
  return createHmac('sha256', salt).update(password).digest('hex');
};

// Secure password comparison
const verifyPassword = (password: string, hash: string): boolean => {
  const expectedHash = hashPassword(password);
  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  const actualBuffer = Buffer.from(hash, 'hex');
  
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  
  return timingSafeEqual(expectedBuffer, actualBuffer);
};

// Simple JWT-like token creation using HMAC
const createToken = (payload: object): string => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = { ...payload, iat: now, exp: now + (24 * 60 * 60) }; // 24 hours

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
  
  const signature = createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

// Simple JWT-like token verification
const verifyToken = (token: string): any => {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  
  // Verify signature
  const expectedSignature = createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  
  if (signature !== expectedSignature) {
    throw new Error('Invalid token signature');
  }

  // Decode payload
  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString());
  
  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error('Token expired');
  }

  return payload;
};

export const loginUser = async (input: LoginInput): Promise<AuthResponse> => {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email.toLowerCase().trim()))
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = users[0];

    // Verify password
    if (!verifyPassword(input.password, user.password_hash)) {
      throw new Error('Invalid email or password');
    }

    // Check if user is verified
    if (!user.is_verified) {
      throw new Error('Account not verified. Please check your email for verification instructions.');
    }

    // Generate JWT-like token
    const tokenPayload = {
      userId: user.id,
      email: user.email,
    };

    const token = createToken(tokenPayload);

    // Calculate expiration date (24 hours from now)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    return {
      user: {
        id: user.id,
        email: user.email,
        password_hash: user.password_hash,
        full_name: user.full_name,
        phone: user.phone,
        is_verified: user.is_verified,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      token,
      expires_at: expiresAt
    };
  } catch (error) {
    console.error('User login failed:', error);
    throw error;
  }
};

// Export verifyToken for testing purposes
export { verifyToken };