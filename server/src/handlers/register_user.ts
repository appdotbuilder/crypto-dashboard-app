import { db } from '../db';
import { usersTable } from '../db/schema';
import { type RegisterInput, type AuthResponse } from '../schema';
import { eq } from 'drizzle-orm';
import { createHash, randomBytes, pbkdf2Sync } from 'crypto';

// Simple JWT implementation using crypto
const createJWT = (payload: any, secret: string, expiresIn: string): string => {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const exp = now + (24 * 60 * 60); // 24 hours

  const jwtPayload = {
    ...payload,
    iat: now,
    exp: exp
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(jwtPayload)).toString('base64url');
  
  const signature = createHash('sha256')
    .update(`${encodedHeader}.${encodedPayload}.${secret}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

const hashPassword = (password: string): string => {
  const salt = randomBytes(32).toString('hex');
  const hash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = (password: string, hashedPassword: string): boolean => {
  const [salt, hash] = hashedPassword.split(':');
  const verifyHash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
};

export const registerUser = async (input: RegisterInput): Promise<AuthResponse> => {
  try {
    // Check if user already exists
    const existingUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (existingUsers.length > 0) {
      throw new Error('Email already registered');
    }

    // Hash the password
    const password_hash = hashPassword(input.password);

    // Insert new user
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        password_hash,
        full_name: input.full_name,
        phone: input.phone || null,
        is_verified: false
      })
      .returning()
      .execute();

    const user = result[0];

    // Generate JWT token
    const tokenPayload = {
      user_id: user.id,
      email: user.email
    };

    const jwtSecret = process.env['JWT_SECRET'] || 'default_secret_key';
    const token = createJWT(tokenPayload, jwtSecret, '24h');

    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

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
      expires_at
    };
  } catch (error) {
    console.error('User registration failed:', error);
    throw error;
  }
};

// Export utility functions for testing
export { verifyPassword, hashPassword };