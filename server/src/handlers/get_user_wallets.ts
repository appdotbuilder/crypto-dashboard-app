import { db } from '../db';
import { walletsTable } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { type Wallet } from '../schema';

export const getUserWallets = async (userId: number): Promise<Wallet[]> => {
  try {
    // Query wallets for the specific user, ordered by creation date (newest first)
    // Primary wallet will be shown first if multiple wallets exist
    const results = await db.select()
      .from(walletsTable)
      .where(eq(walletsTable.user_id, userId))
      .orderBy(desc(walletsTable.is_primary), desc(walletsTable.created_at))
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(wallet => ({
      ...wallet,
      balance: parseFloat(wallet.balance) // Convert numeric string to number
    }));
  } catch (error) {
    console.error('Failed to fetch user wallets:', error);
    throw error;
  }
};