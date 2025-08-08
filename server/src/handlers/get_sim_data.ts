import { db } from '../db';
import { simDataTable } from '../db/schema';
import { type SimData } from '../schema';
import { eq } from 'drizzle-orm';

export const getSimData = async (userId: number): Promise<SimData[]> => {
  try {
    // Query SIM data for the specified user
    const results = await db.select()
      .from(simDataTable)
      .where(eq(simDataTable.user_id, userId))
      .execute();

    // Convert the results to match the schema type
    // Note: Date fields come as strings from database and need conversion
    return results.map(result => ({
      ...result,
      // Convert date strings to Date objects to match schema
      date_of_birth: new Date(result.date_of_birth),
      issued_date: new Date(result.issued_date),
      valid_until: new Date(result.valid_until),
      created_at: new Date(result.created_at)
    }));
  } catch (error) {
    console.error('Failed to fetch SIM data:', error);
    throw error;
  }
};