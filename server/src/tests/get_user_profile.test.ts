import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { getUserProfile } from '../handlers/get_user_profile';
import { eq } from 'drizzle-orm';

// Test user data
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashed_password_123',
  full_name: 'Test User',
  phone: '+6281234567890',
  is_verified: true
};

const testUserNullPhone = {
  email: 'test2@example.com',
  password_hash: 'hashed_password_456',
  full_name: 'Test User Two',
  phone: null,
  is_verified: false
};

describe('getUserProfile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch a user profile successfully', async () => {
    // Insert test user
    const insertedUsers = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = insertedUsers[0].id;

    // Fetch user profile
    const result = await getUserProfile(userId);

    // Verify all fields are returned correctly
    expect(result.id).toEqual(userId);
    expect(result.email).toEqual('test@example.com');
    expect(result.password_hash).toEqual('hashed_password_123');
    expect(result.full_name).toEqual('Test User');
    expect(result.phone).toEqual('+6281234567890');
    expect(result.is_verified).toBe(true);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should handle user with null phone number', async () => {
    // Insert user with null phone
    const insertedUsers = await db.insert(usersTable)
      .values(testUserNullPhone)
      .returning()
      .execute();

    const userId = insertedUsers[0].id;

    // Fetch user profile
    const result = await getUserProfile(userId);

    // Verify null phone is handled correctly
    expect(result.id).toEqual(userId);
    expect(result.email).toEqual('test2@example.com');
    expect(result.full_name).toEqual('Test User Two');
    expect(result.phone).toBeNull();
    expect(result.is_verified).toBe(false);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should throw error when user does not exist', async () => {
    const nonExistentUserId = 999999;

    await expect(getUserProfile(nonExistentUserId)).rejects.toThrow(
      /User with ID 999999 not found/i
    );
  });

  it('should verify user exists in database after retrieval', async () => {
    // Insert test user
    const insertedUsers = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = insertedUsers[0].id;

    // Get profile
    const profile = await getUserProfile(userId);

    // Verify the same user exists in database
    const dbUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    expect(dbUsers).toHaveLength(1);
    expect(dbUsers[0].id).toEqual(profile.id);
    expect(dbUsers[0].email).toEqual(profile.email);
    expect(dbUsers[0].full_name).toEqual(profile.full_name);
    expect(dbUsers[0].phone).toEqual(profile.phone);
    expect(dbUsers[0].is_verified).toEqual(profile.is_verified);
  });

  it('should handle different verification statuses', async () => {
    // Insert verified user
    const verifiedUser = await db.insert(usersTable)
      .values({ ...testUser, is_verified: true })
      .returning()
      .execute();

    // Insert unverified user
    const unverifiedUser = await db.insert(usersTable)
      .values({ 
        ...testUser, 
        email: 'unverified@example.com',
        is_verified: false 
      })
      .returning()
      .execute();

    // Test verified user
    const verifiedProfile = await getUserProfile(verifiedUser[0].id);
    expect(verifiedProfile.is_verified).toBe(true);

    // Test unverified user
    const unverifiedProfile = await getUserProfile(unverifiedUser[0].id);
    expect(unverifiedProfile.is_verified).toBe(false);
  });

  it('should handle timestamps correctly', async () => {
    // Insert user and capture timestamps
    const insertedUsers = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = insertedUsers[0].id;
    const originalCreatedAt = insertedUsers[0].created_at;
    const originalUpdatedAt = insertedUsers[0].updated_at;

    // Fetch profile
    const profile = await getUserProfile(userId);

    // Verify timestamps are Date objects and match original values
    expect(profile.created_at).toBeInstanceOf(Date);
    expect(profile.updated_at).toBeInstanceOf(Date);
    expect(profile.created_at.getTime()).toEqual(originalCreatedAt.getTime());
    expect(profile.updated_at.getTime()).toEqual(originalUpdatedAt.getTime());
  });
});