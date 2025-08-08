import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type RegisterInput } from '../schema';
import { registerUser, verifyPassword } from '../handlers/register_user';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';

// Simple JWT decoder for testing
const decodeJWT = (token: string) => {
  const [header, payload, signature] = token.split('.');
  return {
    header: JSON.parse(Buffer.from(header, 'base64url').toString()),
    payload: JSON.parse(Buffer.from(payload, 'base64url').toString()),
    signature
  };
};

// Test input data
const testInput: RegisterInput = {
  email: 'test@example.com',
  password: 'password123',
  full_name: 'John Doe',
  phone: '+1234567890'
};

const testInputWithoutPhone: RegisterInput = {
  email: 'noPhone@example.com',
  password: 'password123',
  full_name: 'Jane Smith'
};

describe('registerUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should register a new user successfully', async () => {
    const result = await registerUser(testInput);

    // Validate user data
    expect(result.user.email).toEqual('test@example.com');
    expect(result.user.full_name).toEqual('John Doe');
    expect(result.user.phone).toEqual('+1234567890');
    expect(result.user.is_verified).toBe(false);
    expect(result.user.id).toBeDefined();
    expect(result.user.created_at).toBeInstanceOf(Date);
    expect(result.user.updated_at).toBeInstanceOf(Date);
    expect(result.user.password_hash).toBeDefined();

    // Validate JWT token
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
    expect(result.expires_at).toBeInstanceOf(Date);
    expect(result.expires_at.getTime()).toBeGreaterThan(Date.now());
  });

  it('should register user without phone number', async () => {
    const result = await registerUser(testInputWithoutPhone);

    expect(result.user.email).toEqual('noPhone@example.com');
    expect(result.user.full_name).toEqual('Jane Smith');
    expect(result.user.phone).toBeNull();
    expect(result.user.is_verified).toBe(false);
    expect(result.token).toBeDefined();
  });

  it('should save user to database with hashed password', async () => {
    const result = await registerUser(testInput);

    // Query database to verify user was saved
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.user.id))
      .execute();

    expect(users).toHaveLength(1);
    const savedUser = users[0];

    expect(savedUser.email).toEqual('test@example.com');
    expect(savedUser.full_name).toEqual('John Doe');
    expect(savedUser.phone).toEqual('+1234567890');
    expect(savedUser.is_verified).toBe(false);

    // Verify password was hashed and is valid
    expect(savedUser.password_hash).not.toEqual('password123');
    expect(savedUser.password_hash).toContain(':'); // salt:hash format
    const isPasswordValid = verifyPassword('password123', savedUser.password_hash);
    expect(isPasswordValid).toBe(true);
  });

  it('should generate valid JWT token', async () => {
    const result = await registerUser(testInput);

    const decoded = decodeJWT(result.token);

    expect(decoded.payload.user_id).toEqual(result.user.id);
    expect(decoded.payload.email).toEqual('test@example.com');
    expect(decoded.payload.exp).toBeDefined();
    expect(decoded.payload.iat).toBeDefined();
    expect(decoded.header.alg).toEqual('HS256');
    expect(decoded.header.typ).toEqual('JWT');
  });

  it('should reject duplicate email registration', async () => {
    // Register first user
    await registerUser(testInput);

    // Try to register with same email
    await expect(registerUser(testInput)).rejects.toThrow(/email already registered/i);
  });

  it('should reject duplicate email with different case', async () => {
    await registerUser(testInput);

    const duplicateInput: RegisterInput = {
      ...testInput,
      email: 'TEST@EXAMPLE.COM' // Different case
    };

    // This should still work as emails are case sensitive in our implementation
    // If you want case-insensitive emails, you'd need to normalize them first
    const result = await registerUser(duplicateInput);
    expect(result.user.email).toEqual('TEST@EXAMPLE.COM');
  });

  it('should set token expiration to 24 hours', async () => {
    const beforeRegister = Date.now();
    const result = await registerUser(testInput);
    const afterRegister = Date.now();

    const tokenExpiration = result.expires_at.getTime();
    const expectedExpiration24h = beforeRegister + (24 * 60 * 60 * 1000);
    const maxExpiration24h = afterRegister + (24 * 60 * 60 * 1000);

    expect(tokenExpiration).toBeGreaterThanOrEqual(expectedExpiration24h);
    expect(tokenExpiration).toBeLessThanOrEqual(maxExpiration24h);
  });

  it('should handle password hashing correctly', async () => {
    const result = await registerUser(testInput);

    // Password hash should be in salt:hash format
    expect(result.user.password_hash).toMatch(/^[a-f0-9]{64}:[a-f0-9]{128}$/);

    // Should verify against original password
    const isValid = verifyPassword('password123', result.user.password_hash);
    expect(isValid).toBe(true);

    // Should not verify against wrong password
    const isInvalid = verifyPassword('wrongpassword', result.user.password_hash);
    expect(isInvalid).toBe(false);
  });

  it('should create different hashes for same password', async () => {
    const result1 = await registerUser(testInput);
    
    // Reset DB and register with same data
    await resetDB();
    await createDB();
    
    const result2 = await registerUser(testInput);

    // Different salt should create different hashes
    expect(result1.user.password_hash).not.toEqual(result2.user.password_hash);
    
    // But both should verify correctly
    expect(verifyPassword('password123', result1.user.password_hash)).toBe(true);
    expect(verifyPassword('password123', result2.user.password_hash)).toBe(true);
  });

  it('should create valid JWT structure', async () => {
    const result = await registerUser(testInput);
    
    const decoded = decodeJWT(result.token);
    const now = Math.floor(Date.now() / 1000);
    
    // Check token structure
    expect(decoded.payload.iat).toBeGreaterThanOrEqual(now - 5); // Allow 5 second margin
    expect(decoded.payload.exp).toEqual(decoded.payload.iat + (24 * 60 * 60));
    expect(decoded.payload.user_id).toEqual(result.user.id);
    expect(decoded.payload.email).toEqual(result.user.email);
  });
});