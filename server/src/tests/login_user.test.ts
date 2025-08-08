import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput } from '../schema';
import { loginUser, verifyToken } from '../handlers/login_user';
import { createHmac } from 'crypto';

// Helper function to hash passwords (same as in handler)
const hashPassword = (password: string, salt: string = 'default-salt'): string => {
  return createHmac('sha256', salt).update(password).digest('hex');
};

// Test data
const testUser = {
  email: 'john.doe@example.com',
  password_hash: hashPassword('password123'),
  full_name: 'John Doe',
  phone: '+1234567890',
  is_verified: true
};

const unverifiedUser = {
  email: 'unverified@example.com',
  password_hash: hashPassword('password123'),
  full_name: 'Unverified User',
  phone: null,
  is_verified: false
};

const validLoginInput: LoginInput = {
  email: 'john.doe@example.com',
  password: 'password123'
};

const invalidPasswordInput: LoginInput = {
  email: 'john.doe@example.com',
  password: 'wrongpassword'
};

const nonExistentUserInput: LoginInput = {
  email: 'nonexistent@example.com',
  password: 'password123'
};

const unverifiedUserInput: LoginInput = {
  email: 'unverified@example.com',
  password: 'password123'
};

describe('loginUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should successfully login a verified user with valid credentials', async () => {
    // Create test user
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    const result = await loginUser(validLoginInput);

    // Verify user data
    expect(result.user.email).toEqual('john.doe@example.com');
    expect(result.user.full_name).toEqual('John Doe');
    expect(result.user.phone).toEqual('+1234567890');
    expect(result.user.is_verified).toBe(true);
    expect(result.user.id).toBeDefined();
    expect(result.user.created_at).toBeInstanceOf(Date);
    expect(result.user.updated_at).toBeInstanceOf(Date);
    expect(result.user.password_hash).toEqual(testUser.password_hash);

    // Verify JWT token
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');

    // Verify token contents
    const decodedToken = verifyToken(result.token);
    expect(decodedToken.userId).toEqual(result.user.id);
    expect(decodedToken.email).toEqual('john.doe@example.com');
    expect(decodedToken.iat).toBeDefined();
    expect(decodedToken.exp).toBeDefined();

    // Verify expiration date (should be ~24 hours from now)
    expect(result.expires_at).toBeInstanceOf(Date);
    const now = new Date();
    const expectedExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const timeDiff = Math.abs(result.expires_at.getTime() - expectedExpiry.getTime());
    expect(timeDiff).toBeLessThan(5000); // Within 5 seconds tolerance
  });

  it('should handle email case insensitivity', async () => {
    // Create test user
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    // Login with uppercase email
    const uppercaseEmailInput: LoginInput = {
      email: 'JOHN.DOE@EXAMPLE.COM',
      password: 'password123'
    };

    const result = await loginUser(uppercaseEmailInput);

    expect(result.user.email).toEqual('john.doe@example.com');
    expect(result.token).toBeDefined();
  });

  it('should handle email with extra whitespace', async () => {
    // Create test user
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    // Login with email containing whitespace
    const whitespaceEmailInput: LoginInput = {
      email: '  john.doe@example.com  ',
      password: 'password123'
    };

    const result = await loginUser(whitespaceEmailInput);

    expect(result.user.email).toEqual('john.doe@example.com');
    expect(result.token).toBeDefined();
  });

  it('should throw error for non-existent user', async () => {
    await expect(loginUser(nonExistentUserInput))
      .rejects
      .toThrow(/invalid email or password/i);
  });

  it('should throw error for invalid password', async () => {
    // Create test user
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    await expect(loginUser(invalidPasswordInput))
      .rejects
      .toThrow(/invalid email or password/i);
  });

  it('should throw error for unverified user', async () => {
    // Create unverified user
    await db.insert(usersTable)
      .values(unverifiedUser)
      .execute();

    await expect(loginUser(unverifiedUserInput))
      .rejects
      .toThrow(/account not verified/i);
  });

  it('should handle user with null phone number', async () => {
    const userWithNullPhone = {
      ...testUser,
      email: 'nullphone@example.com',
      phone: null
    };

    await db.insert(usersTable)
      .values(userWithNullPhone)
      .execute();

    const loginInput: LoginInput = {
      email: 'nullphone@example.com',
      password: 'password123'
    };

    const result = await loginUser(loginInput);

    expect(result.user.phone).toBeNull();
    expect(result.user.email).toEqual('nullphone@example.com');
    expect(result.token).toBeDefined();
  });

  it('should generate different tokens for different login sessions', async () => {
    // Create test user
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    // Login twice with small delay to ensure different timestamps
    const result1 = await loginUser(validLoginInput);
    
    // Wait a moment to ensure different iat timestamp
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const result2 = await loginUser(validLoginInput);

    expect(result1.token).not.toEqual(result2.token);
    expect(result1.user.id).toEqual(result2.user.id);
  });

  it('should validate JWT token structure and claims', async () => {
    // Create test user
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    const result = await loginUser(validLoginInput);

    // Decode and verify token structure
    const decodedToken = verifyToken(result.token);
    
    expect(decodedToken.userId).toEqual(result.user.id);
    expect(decodedToken.email).toEqual('john.doe@example.com');
    expect(decodedToken.iat).toBeDefined();
    expect(typeof decodedToken.iat).toBe('number');
    expect(decodedToken.exp).toBeDefined();
    
    // Verify token is not expired
    const now = Math.floor(Date.now() / 1000);
    expect(decodedToken.exp).toBeGreaterThan(now);
  });

  it('should handle password with special characters', async () => {
    const specialPasswordUser = {
      ...testUser,
      email: 'special@example.com',
      password_hash: hashPassword('P@ssw0rd!@#$%^&*()')
    };

    await db.insert(usersTable)
      .values(specialPasswordUser)
      .execute();

    const specialPasswordInput: LoginInput = {
      email: 'special@example.com',
      password: 'P@ssw0rd!@#$%^&*()'
    };

    const result = await loginUser(specialPasswordInput);

    expect(result.user.email).toEqual('special@example.com');
    expect(result.token).toBeDefined();
  });

  it('should create valid JWT-like tokens that can be verified', async () => {
    // Create test user
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    const result = await loginUser(validLoginInput);

    // Token should have 3 parts separated by dots
    const tokenParts = result.token.split('.');
    expect(tokenParts).toHaveLength(3);

    // Should be able to verify the token
    const decodedToken = verifyToken(result.token);
    expect(decodedToken.userId).toEqual(result.user.id);
    expect(decodedToken.email).toEqual(result.user.email);
  });

  it('should reject invalid tokens', async () => {
    const invalidToken = 'invalid.token.here';
    
    await expect(() => verifyToken(invalidToken))
      .toThrow(/invalid token/i);
  });

  it('should handle token format validation', async () => {
    // Token with wrong number of parts
    const malformedToken = 'header.payload';
    
    await expect(() => verifyToken(malformedToken))
      .toThrow(/invalid token format/i);
  });
});