import { db } from '../db';
import { usersTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type User } from '../schema';

export const getUserProfile = async (userId: number): Promise<User> => {
  try {
    // Query user by ID
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (users.length === 0) {
      throw new Error(`User with ID ${userId} not found`);
    }

    const user = users[0];

    // Return user data matching the schema format
    return {
      id: user.id,
      email: user.email,
      password_hash: user.password_hash,
      full_name: user.full_name,
      phone: user.phone,
      is_verified: user.is_verified,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  } catch (error) {
    console.error('Get user profile failed:', error);
    throw error;
  }
};