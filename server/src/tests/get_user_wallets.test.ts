import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, walletsTable } from '../db/schema';
import { getUserWallets } from '../handlers/get_user_wallets';
import { eq } from 'drizzle-orm';

// Test user data
const testUser = {
  email: 'testuser@example.com',
  password_hash: 'hashed_password',
  full_name: 'Test User',
  phone: '+1234567890',
  is_verified: true
};

// Test wallet data
const testWallets = [
  {
    wallet_address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    wallet_type: 'BITCOIN' as const,
    balance: '0.05432100',
    private_key_encrypted: 'encrypted_btc_key',
    is_primary: true
  },
  {
    wallet_address: '0x742d35Cc6634C0532925a3b8D4C5C1C9d8c9f8e4',
    wallet_type: 'ETHEREUM' as const,
    balance: '1.25000000',
    private_key_encrypted: 'encrypted_eth_key',
    is_primary: false
  },
  {
    wallet_address: '0x123abc456def789ghi012jkl345mno678pqr901st',
    wallet_type: 'POLYGON' as const,
    balance: '100.50000000',
    private_key_encrypted: null, // Test nullable field
    is_primary: false
  }
];

describe('getUserWallets', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when user has no wallets', async () => {
    // Create user without wallets
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;

    const wallets = await getUserWallets(userId);

    expect(wallets).toEqual([]);
  });

  it('should return user wallets with correct data structure', async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create wallets for the user
    const walletResults = await db.insert(walletsTable)
      .values(testWallets.map(wallet => ({
        ...wallet,
        user_id: userId
      })))
      .returning()
      .execute();

    const wallets = await getUserWallets(userId);

    expect(wallets).toHaveLength(3);

    // Check that all required fields are present and correctly typed
    wallets.forEach(wallet => {
      expect(wallet.id).toBeDefined();
      expect(typeof wallet.id).toBe('number');
      expect(wallet.user_id).toBe(userId);
      expect(typeof wallet.wallet_address).toBe('string');
      expect(['BITCOIN', 'ETHEREUM', 'BINANCE_SMART_CHAIN', 'POLYGON']).toContain(wallet.wallet_type);
      expect(typeof wallet.balance).toBe('number'); // Should be converted from string
      expect(typeof wallet.is_primary).toBe('boolean');
      expect(wallet.created_at).toBeInstanceOf(Date);
      expect(wallet.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should convert numeric balance fields correctly', async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create wallet with specific balance
    await db.insert(walletsTable)
      .values({
        user_id: userId,
        wallet_address: 'test_address',
        wallet_type: 'BITCOIN',
        balance: '0.12345678', // String in database
        is_primary: true
      })
      .execute();

    const wallets = await getUserWallets(userId);

    expect(wallets).toHaveLength(1);
    expect(typeof wallets[0].balance).toBe('number');
    expect(wallets[0].balance).toBe(0.12345678);
  });

  it('should order wallets by primary status and creation date', async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create wallets with different creation times and primary status
    const now = new Date();
    const earlier = new Date(now.getTime() - 60000); // 1 minute earlier
    const latest = new Date(now.getTime() + 60000); // 1 minute later

    await db.insert(walletsTable)
      .values([
        {
          user_id: userId,
          wallet_address: 'oldest_secondary',
          wallet_type: 'ETHEREUM',
          balance: '1.0',
          is_primary: false,
          created_at: earlier
        },
        {
          user_id: userId,
          wallet_address: 'primary_wallet',
          wallet_type: 'BITCOIN',
          balance: '2.0',
          is_primary: true,
          created_at: now
        },
        {
          user_id: userId,
          wallet_address: 'newest_secondary',
          wallet_type: 'POLYGON',
          balance: '3.0',
          is_primary: false,
          created_at: latest
        }
      ])
      .execute();

    const wallets = await getUserWallets(userId);

    expect(wallets).toHaveLength(3);
    // Primary wallet should be first
    expect(wallets[0].is_primary).toBe(true);
    expect(wallets[0].wallet_address).toBe('primary_wallet');
    
    // Among non-primary wallets, newest should come before oldest
    expect(wallets[1].wallet_address).toBe('newest_secondary');
    expect(wallets[2].wallet_address).toBe('oldest_secondary');
  });

  it('should only return wallets for the specified user', async () => {
    // Create two users
    const user1Result = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        ...testUser,
        email: 'user2@example.com'
      })
      .returning()
      .execute();

    const user1Id = user1Result[0].id;
    const user2Id = user2Result[0].id;

    // Create wallets for both users
    await db.insert(walletsTable)
      .values([
        {
          user_id: user1Id,
          wallet_address: 'user1_wallet',
          wallet_type: 'BITCOIN',
          balance: '1.0',
          is_primary: true
        },
        {
          user_id: user2Id,
          wallet_address: 'user2_wallet',
          wallet_type: 'ETHEREUM',
          balance: '2.0',
          is_primary: true
        }
      ])
      .execute();

    // Get wallets for user1
    const user1Wallets = await getUserWallets(user1Id);
    expect(user1Wallets).toHaveLength(1);
    expect(user1Wallets[0].wallet_address).toBe('user1_wallet');
    expect(user1Wallets[0].user_id).toBe(user1Id);

    // Get wallets for user2
    const user2Wallets = await getUserWallets(user2Id);
    expect(user2Wallets).toHaveLength(1);
    expect(user2Wallets[0].wallet_address).toBe('user2_wallet');
    expect(user2Wallets[0].user_id).toBe(user2Id);
  });

  it('should handle null private_key_encrypted field', async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create wallet with null private key
    await db.insert(walletsTable)
      .values({
        user_id: userId,
        wallet_address: 'test_wallet',
        wallet_type: 'BITCOIN',
        balance: '1.0',
        private_key_encrypted: null,
        is_primary: true
      })
      .execute();

    const wallets = await getUserWallets(userId);

    expect(wallets).toHaveLength(1);
    expect(wallets[0].private_key_encrypted).toBeNull();
  });

  it('should handle different wallet types', async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create wallets with different types
    const walletTypes = ['BITCOIN', 'ETHEREUM', 'BINANCE_SMART_CHAIN', 'POLYGON'] as const;
    
    await db.insert(walletsTable)
      .values(walletTypes.map((type, index) => ({
        user_id: userId,
        wallet_address: `wallet_${type.toLowerCase()}`,
        wallet_type: type,
        balance: `${index + 1}.0`,
        is_primary: index === 0
      })))
      .execute();

    const wallets = await getUserWallets(userId);

    expect(wallets).toHaveLength(4);
    
    // Check that all wallet types are present
    const returnedTypes = wallets.map(w => w.wallet_type).sort();
    expect(returnedTypes).toEqual(walletTypes.slice().sort());
  });
});