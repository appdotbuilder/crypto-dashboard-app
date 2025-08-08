import { db } from '../db';
import { ktpDataTable } from '../db/schema';
import { type KtpData } from '../schema';
import { eq } from 'drizzle-orm';

export const getKtpData = async (userId: number): Promise<KtpData | null> => {
  try {
    const results = await db.select()
      .from(ktpDataTable)
      .where(eq(ktpDataTable.user_id, userId))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const ktpRecord = results[0];
    
    // Return the KTP data with proper date parsing
    return {
      ...ktpRecord,
      date_of_birth: new Date(ktpRecord.date_of_birth),
      created_at: new Date(ktpRecord.created_at)
    };
  } catch (error) {
    console.error('Failed to fetch KTP data:', error);
    throw error;
  }
};