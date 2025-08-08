import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type UpdateUserProfileInput } from '../schema';
import { updateUserProfile } from '../handlers/update_user_profile';
import { eq } from 'drizzle-orm';

describe('updateUserProfile', () => {
  let testUserId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_current_password',
        full_name: 'John Doe',
        phone: '+6281234567890',
        is_verified: true
      })
      .returning()
      .execute();
    
    testUserId = userResult[0].id;
  });

  afterEach(resetDB);

  it('should update user full name', async () => {
    const input: UpdateUserProfileInput = {
      user_id: testUserId,
      full_name: 'Jane Smith'
    };

    const result = await updateUserProfile(input);

    expect(result.full_name).toEqual('Jane Smith');
    expect(result.email).toEqual('test@example.com');
    expect(result.phone).toEqual('+6281234567890');
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify the update in the database
    const updatedUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, testUserId))
      .execute();

    expect(updatedUser[0].full_name).toEqual('Jane Smith');
    expect(updatedUser[0].updated_at).toBeInstanceOf(Date);
  });

  it('should update user phone', async () => {
    const input: UpdateUserProfileInput = {
      user_id: testUserId,
      phone: '+628987654321'
    };

    const result = await updateUserProfile(input);

    expect(result.phone).toEqual('+628987654321');
    expect(result.full_name).toEqual('John Doe'); // Should remain unchanged

    // Verify in database
    const updatedUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, testUserId))
      .execute();

    expect(updatedUser[0].phone).toEqual('+628987654321');
  });

  it('should set phone to null', async () => {
    const input: UpdateUserProfileInput = {
      user_id: testUserId,
      phone: null
    };

    const result = await updateUserProfile(input);

    expect(result.phone).toBeNull();

    // Verify in database
    const updatedUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, testUserId))
      .execute();

    expect(updatedUser[0].phone).toBeNull();
  });

  it('should update multiple fields at once', async () => {
    const input: UpdateUserProfileInput = {
      user_id: testUserId,
      full_name: 'Jane Smith',
      phone: '+628111222333'
    };

    const result = await updateUserProfile(input);

    expect(result.full_name).toEqual('Jane Smith');
    expect(result.phone).toEqual('+628111222333');
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify in database
    const updatedUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, testUserId))
      .execute();

    expect(updatedUser[0].full_name).toEqual('Jane Smith');
    expect(updatedUser[0].phone).toEqual('+628111222333');
  });

  it('should update password with correct current password', async () => {
    const input: UpdateUserProfileInput = {
      user_id: testUserId,
      current_password: 'correct_password',
      new_password: 'new_secure_password'
    };

    const result = await updateUserProfile(input);

    expect(result.password_hash).toEqual('hashed_new_secure_password');
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify in database
    const updatedUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, testUserId))
      .execute();

    expect(updatedUser[0].password_hash).toEqual('hashed_new_secure_password');
  });

  it('should update password and other fields together', async () => {
    const input: UpdateUserProfileInput = {
      user_id: testUserId,
      full_name: 'Updated Name',
      current_password: 'correct_password',
      new_password: 'new_secure_password'
    };

    const result = await updateUserProfile(input);

    expect(result.full_name).toEqual('Updated Name');
    expect(result.password_hash).toEqual('hashed_new_secure_password');

    // Verify in database
    const updatedUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, testUserId))
      .execute();

    expect(updatedUser[0].full_name).toEqual('Updated Name');
    expect(updatedUser[0].password_hash).toEqual('hashed_new_secure_password');
  });

  it('should throw error for non-existent user', async () => {
    const input: UpdateUserProfileInput = {
      user_id: 99999,
      full_name: 'Test Name'
    };

    await expect(updateUserProfile(input)).rejects.toThrow(/user not found/i);
  });

  it('should throw error when new password provided without current password', async () => {
    const input: UpdateUserProfileInput = {
      user_id: testUserId,
      new_password: 'new_password'
    };

    await expect(updateUserProfile(input)).rejects.toThrow(/current password is required/i);
  });

  it('should throw error with incorrect current password', async () => {
    const input: UpdateUserProfileInput = {
      user_id: testUserId,
      current_password: 'wrong_password',
      new_password: 'new_password'
    };

    await expect(updateUserProfile(input)).rejects.toThrow(/current password is incorrect/i);
  });

  it('should handle empty updates gracefully', async () => {
    const input: UpdateUserProfileInput = {
      user_id: testUserId
    };

    const result = await updateUserProfile(input);

    // Should return the user with only updated_at changed
    expect(result.full_name).toEqual('John Doe'); // Original value
    expect(result.phone).toEqual('+6281234567890'); // Original value
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should preserve other user data during updates', async () => {
    const input: UpdateUserProfileInput = {
      user_id: testUserId,
      full_name: 'New Name'
    };

    const result = await updateUserProfile(input);

    // Should preserve all other original data
    expect(result.email).toEqual('test@example.com');
    expect(result.is_verified).toEqual(true);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.id).toEqual(testUserId);
  });
});