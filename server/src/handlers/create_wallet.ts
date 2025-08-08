import { db } from '../db';
import { walletsTable, usersTable } from '../db/schema';
import { type CreateWalletInput, type Wallet } from '../schema';
import { eq } from 'drizzle-orm';

export const createWallet = async (input: CreateWalletInput): Promise<Wallet> => {
  try {
    // Verify that the user exists
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (users.length === 0) {
      throw new Error(`User with ID ${input.user_id} not found`);
    }

    // Generate mock wallet addresses based on wallet type
    // In real implementation, this would use crypto libraries
    const mockAddresses = {
      BITCOIN: `1${Math.random().toString(36).substring(2, 30)}`,
      ETHEREUM: `0x${Math.random().toString(16).substring(2, 42)}`,
      BINANCE_SMART_CHAIN: `0x${Math.random().toString(16).substring(2, 42)}`,
      POLYGON: `0x${Math.random().toString(16).substring(2, 42)}`
    };

    // Generate a mock encrypted private key
    const mockPrivateKey = `encrypted_${Math.random().toString(36).substring(2, 30)}`;

    // If this wallet should be primary, set all other wallets for this user to non-primary
    if (input.is_primary) {
      await db.update(walletsTable)
        .set({ is_primary: false })
        .where(eq(walletsTable.user_id, input.user_id))
        .execute();
    }

    // Insert the new wallet
    const result = await db.insert(walletsTable)
      .values({
        user_id: input.user_id,
        wallet_address: mockAddresses[input.wallet_type],
        wallet_type: input.wallet_type,
        balance: '0', // Convert number to string for numeric column
        private_key_encrypted: mockPrivateKey,
        is_primary: input.is_primary || false
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const wallet = result[0];
    return {
      ...wallet,
      balance: parseFloat(wallet.balance) // Convert string back to number
    };
  } catch (error) {
    console.error('Wallet creation failed:', error);
    throw error;
  }
};