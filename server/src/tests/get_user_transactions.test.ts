import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  walletsTable, 
  cryptoAssetsTable, 
  transactionsTable 
} from '../db/schema';
import { getUserTransactions } from '../handlers/get_user_transactions';

describe('getUserTransactions', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const createTestData = async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'user1@test.com',
          password_hash: 'hash1',
          full_name: 'User One',
          is_verified: true
        },
        {
          email: 'user2@test.com',
          password_hash: 'hash2',
          full_name: 'User Two',
          is_verified: true
        }
      ])
      .returning()
      .execute();

    const user1Id = users[0].id;
    const user2Id = users[1].id;

    // Create test wallets
    const wallets = await db.insert(walletsTable)
      .values([
        {
          user_id: user1Id,
          wallet_address: '0x123abc...',
          wallet_type: 'ETHEREUM',
          balance: '1000.0',
          is_primary: true
        },
        {
          user_id: user2Id,
          wallet_address: '0x456def...',
          wallet_type: 'BITCOIN',
          balance: '500.0',
          is_primary: true
        }
      ])
      .returning()
      .execute();

    const wallet1Id = wallets[0].id;
    const wallet2Id = wallets[1].id;

    // Create test crypto assets
    await db.insert(cryptoAssetsTable)
      .values([
        {
          symbol: 'BTC',
          name: 'Bitcoin',
          current_price: '43000.0',
          price_change_24h: '500.0',
          price_change_percentage_24h: '1.18',
          market_cap: '850000000000.0',
          volume_24h: '15000000000.0'
        },
        {
          symbol: 'ETH',
          name: 'Ethereum',
          current_price: '2650.0',
          price_change_24h: '-25.0',
          price_change_percentage_24h: '-0.93',
          market_cap: '320000000000.0',
          volume_24h: '8000000000.0'
        }
      ])
      .execute();

    // Create test transactions for user1 (multiple transactions)
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    await db.insert(transactionsTable)
      .values([
        // Most recent transaction (should appear first)
        {
          user_id: user1Id,
          wallet_id: wallet1Id,
          transaction_type: 'BUY',
          asset_symbol: 'BTC',
          amount: '0.01',
          price_per_unit: '43000.0',
          total_value: '430.43',
          fee: '0.43',
          status: 'COMPLETED',
          transaction_hash: '0xabc123',
          created_at: oneHourAgo,
          completed_at: oneHourAgo
        },
        // Middle transaction
        {
          user_id: user1Id,
          wallet_id: wallet1Id,
          transaction_type: 'SELL',
          asset_symbol: 'ETH',
          amount: '0.5',
          price_per_unit: '2650.0',
          total_value: '1323.68',
          fee: '1.32',
          status: 'COMPLETED',
          transaction_hash: '0xdef456',
          created_at: oneDayAgo,
          completed_at: oneDayAgo
        },
        // Oldest transaction
        {
          user_id: user1Id,
          wallet_id: wallet1Id,
          transaction_type: 'BUY',
          asset_symbol: 'ETH',
          amount: '1.0',
          price_per_unit: '2700.0',
          total_value: '2702.70',
          fee: '2.70',
          status: 'COMPLETED',
          transaction_hash: '0xghi789',
          created_at: twoDaysAgo,
          completed_at: twoDaysAgo
        },
        // Transaction for different user (should not appear in user1 results)
        {
          user_id: user2Id,
          wallet_id: wallet2Id,
          transaction_type: 'BUY',
          asset_symbol: 'BTC',
          amount: '0.02',
          price_per_unit: '42000.0',
          total_value: '840.84',
          fee: '0.84',
          status: 'COMPLETED',
          transaction_hash: '0xjkl012',
          created_at: oneHourAgo,
          completed_at: oneHourAgo
        }
      ])
      .execute();

    return { user1Id, user2Id, wallet1Id, wallet2Id };
  };

  it('should return all transactions for a user ordered by most recent first', async () => {
    const { user1Id } = await createTestData();

    const transactions = await getUserTransactions(user1Id);

    expect(transactions).toHaveLength(3);
    
    // Verify transactions are ordered by most recent first
    expect(transactions[0].asset_symbol).toBe('BTC'); // Most recent
    expect(transactions[1].asset_symbol).toBe('ETH'); // 1 day ago
    expect(transactions[2].asset_symbol).toBe('ETH'); // 2 days ago
    
    // Verify all transactions belong to the correct user
    transactions.forEach(transaction => {
      expect(transaction.user_id).toBe(user1Id);
    });
    
    // Verify date ordering
    expect(transactions[0].created_at >= transactions[1].created_at).toBe(true);
    expect(transactions[1].created_at >= transactions[2].created_at).toBe(true);
  });

  it('should return limited number of transactions when limit is specified', async () => {
    const { user1Id } = await createTestData();

    const transactions = await getUserTransactions(user1Id, 2);

    expect(transactions).toHaveLength(2);
    
    // Should return the 2 most recent transactions
    expect(transactions[0].asset_symbol).toBe('BTC'); // Most recent
    expect(transactions[1].asset_symbol).toBe('ETH'); // Second most recent
  });

  it('should return empty array when user has no transactions', async () => {
    const { user2Id } = await createTestData();
    
    // Delete the transaction we created for user2 in createTestData
    await db.delete(transactionsTable).execute();
    
    // Create a user with no transactions
    const [newUser] = await db.insert(usersTable)
      .values({
        email: 'empty@test.com',
        password_hash: 'hash',
        full_name: 'Empty User',
        is_verified: true
      })
      .returning()
      .execute();

    const transactions = await getUserTransactions(newUser.id);

    expect(transactions).toHaveLength(0);
  });

  it('should handle limit of 0 correctly', async () => {
    const { user1Id } = await createTestData();

    const transactions = await getUserTransactions(user1Id, 0);

    expect(transactions).toHaveLength(0);
  });

  it('should handle limit greater than available transactions', async () => {
    const { user1Id } = await createTestData();

    const transactions = await getUserTransactions(user1Id, 10);

    expect(transactions).toHaveLength(3); // Only 3 transactions exist
  });

  it('should convert numeric fields to numbers correctly', async () => {
    const { user1Id } = await createTestData();

    const transactions = await getUserTransactions(user1Id, 1);

    expect(transactions).toHaveLength(1);
    
    const transaction = transactions[0];
    expect(typeof transaction.amount).toBe('number');
    expect(typeof transaction.price_per_unit).toBe('number');
    expect(typeof transaction.total_value).toBe('number');
    expect(typeof transaction.fee).toBe('number');
    
    // Verify specific values
    expect(transaction.amount).toBe(0.01);
    expect(transaction.price_per_unit).toBe(43000.0);
    expect(transaction.total_value).toBe(430.43);
    expect(transaction.fee).toBe(0.43);
  });

  it('should return transactions with all required fields', async () => {
    const { user1Id } = await createTestData();

    const transactions = await getUserTransactions(user1Id, 1);

    expect(transactions).toHaveLength(1);
    
    const transaction = transactions[0];
    expect(transaction.id).toBeDefined();
    expect(transaction.user_id).toBe(user1Id);
    expect(transaction.wallet_id).toBeDefined();
    expect(transaction.transaction_type).toBe('BUY');
    expect(transaction.asset_symbol).toBe('BTC');
    expect(transaction.amount).toBeDefined();
    expect(transaction.price_per_unit).toBeDefined();
    expect(transaction.total_value).toBeDefined();
    expect(transaction.fee).toBeDefined();
    expect(transaction.status).toBe('COMPLETED');
    expect(transaction.transaction_hash).toBe('0xabc123');
    expect(transaction.created_at).toBeInstanceOf(Date);
    expect(transaction.completed_at).toBeInstanceOf(Date);
  });

  it('should only return transactions for the specified user', async () => {
    const { user1Id, user2Id } = await createTestData();

    const user1Transactions = await getUserTransactions(user1Id);
    const user2Transactions = await getUserTransactions(user2Id);

    // User 1 should have 3 transactions
    expect(user1Transactions).toHaveLength(3);
    user1Transactions.forEach(transaction => {
      expect(transaction.user_id).toBe(user1Id);
    });

    // User 2 should have 1 transaction
    expect(user2Transactions).toHaveLength(1);
    user2Transactions.forEach(transaction => {
      expect(transaction.user_id).toBe(user2Id);
    });
  });
});