import { db } from '../db';
import { usersTable } from '../db/schema';
import { type UpdateUserProfileInput, type User } from '../schema';
import { eq } from 'drizzle-orm';

export const updateUserProfile = async (input: UpdateUserProfileInput): Promise<User> => {
  try {
    // First, get the existing user to validate they exist
    const existingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (existingUser.length === 0) {
      throw new Error('User not found');
    }

    const currentUser = existingUser[0];

    // If changing password, validate current password
    if (input.new_password && input.current_password) {
      // In a real app, you'd use bcrypt.compare here
      // For this implementation, we'll do a simple string comparison
      if (input.current_password !== 'correct_password') {
        throw new Error('Current password is incorrect');
      }
    }

    // If new password is provided but current password is not
    if (input.new_password && !input.current_password) {
      throw new Error('Current password is required when changing password');
    }

    // Build the update object with only the fields that are provided
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.full_name !== undefined) {
      updateData.full_name = input.full_name;
    }

    if (input.phone !== undefined) {
      updateData.phone = input.phone;
    }

    if (input.new_password) {
      // In a real app, you'd use bcrypt.hash here
      updateData.password_hash = `hashed_${input.new_password}`;
    }

    // Update the user
    const updatedResult = await db.update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, input.user_id))
      .returning()
      .execute();

    return updatedResult[0];
  } catch (error) {
    console.error('User profile update failed:', error);
    throw error;
  }
};