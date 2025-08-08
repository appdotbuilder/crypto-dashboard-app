import { db } from '../db';
import { transactionsTable } from '../db/schema';
import { type Transaction } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const getUserTransactions = async (userId: number, limit?: number): Promise<Transaction[]> => {
  try {
    // Build the query with conditional limit
    const baseQuery = db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.user_id, userId))
      .orderBy(desc(transactionsTable.created_at));

    // Apply limit if provided (including 0 to return empty array)
    const query = limit !== undefined ? baseQuery.limit(limit) : baseQuery;

    const results = await query.execute();

    // Convert numeric fields back to numbers before returning
    return results.map(transaction => ({
      ...transaction,
      amount: parseFloat(transaction.amount),
      price_per_unit: parseFloat(transaction.price_per_unit),
      total_value: parseFloat(transaction.total_value),
      fee: parseFloat(transaction.fee)
    }));
  } catch (error) {
    console.error('Failed to fetch user transactions:', error);
    throw error;
  }
};