import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { walletsTable, usersTable } from '../db/schema';
import { type CreateWalletInput } from '../schema';
import { createWallet } from '../handlers/create_wallet';
import { eq, and } from 'drizzle-orm';

// Create test user data
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashed_password_123',
  full_name: 'Test User',
  phone: '+1234567890',
  is_verified: true
};

// Simple test input
const testInput: CreateWalletInput = {
  user_id: 1,
  wallet_type: 'ETHEREUM',
  is_primary: false
};

describe('createWallet', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a wallet successfully', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const input: CreateWalletInput = {
      user_id: userResult[0].id,
      wallet_type: 'ETHEREUM',
      is_primary: false
    };

    const result = await createWallet(input);

    // Basic field validation
    expect(result.user_id).toEqual(userResult[0].id);
    expect(result.wallet_type).toEqual('ETHEREUM');
    expect(result.balance).toEqual(0);
    expect(typeof result.balance).toBe('number');
    expect(result.is_primary).toEqual(false);
    expect(result.id).toBeDefined();
    expect(result.wallet_address).toBeDefined();
    expect(result.wallet_address.startsWith('0x')).toBe(true);
    expect(result.private_key_encrypted).toBeDefined();
    expect(result.private_key_encrypted).not.toBeNull();
    expect(result.private_key_encrypted!.startsWith('encrypted_')).toBe(true);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save wallet to database', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const input: CreateWalletInput = {
      user_id: userResult[0].id,
      wallet_type: 'BITCOIN',
      is_primary: true
    };

    const result = await createWallet(input);

    // Query using proper drizzle syntax
    const wallets = await db.select()
      .from(walletsTable)
      .where(eq(walletsTable.id, result.id))
      .execute();

    expect(wallets).toHaveLength(1);
    expect(wallets[0].user_id).toEqual(userResult[0].id);
    expect(wallets[0].wallet_type).toEqual('BITCOIN');
    expect(parseFloat(wallets[0].balance)).toEqual(0);
    expect(wallets[0].is_primary).toEqual(true);
    expect(wallets[0].created_at).toBeInstanceOf(Date);
    expect(wallets[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create different address formats for different wallet types', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Test Bitcoin wallet
    const bitcoinResult = await createWallet({
      user_id: userResult[0].id,
      wallet_type: 'BITCOIN'
    });

    // Test Ethereum wallet
    const ethereumResult = await createWallet({
      user_id: userResult[0].id,
      wallet_type: 'ETHEREUM'
    });

    // Test Polygon wallet
    const polygonResult = await createWallet({
      user_id: userResult[0].id,
      wallet_type: 'POLYGON'
    });

    // Bitcoin addresses should be defined and have reasonable length
    expect(bitcoinResult.wallet_address).toBeDefined();
    expect(bitcoinResult.wallet_address.length).toBeGreaterThan(10);

    // Ethereum and compatible addresses start with '0x'
    expect(ethereumResult.wallet_address.startsWith('0x')).toBe(true);
    expect(polygonResult.wallet_address.startsWith('0x')).toBe(true);

    // All should have unique addresses
    expect(bitcoinResult.wallet_address).not.toEqual(ethereumResult.wallet_address);
    expect(ethereumResult.wallet_address).not.toEqual(polygonResult.wallet_address);
  });

  it('should set wallet as primary and update other wallets', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create first wallet as primary
    const firstWallet = await createWallet({
      user_id: userResult[0].id,
      wallet_type: 'ETHEREUM',
      is_primary: true
    });

    expect(firstWallet.is_primary).toBe(true);

    // Create second wallet as primary
    const secondWallet = await createWallet({
      user_id: userResult[0].id,
      wallet_type: 'BITCOIN',
      is_primary: true
    });

    expect(secondWallet.is_primary).toBe(true);

    // Check that first wallet is no longer primary
    const firstWalletUpdated = await db.select()
      .from(walletsTable)
      .where(eq(walletsTable.id, firstWallet.id))
      .execute();

    expect(firstWalletUpdated[0].is_primary).toBe(false);
  });

  it('should default is_primary to false when not specified', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const input: CreateWalletInput = {
      user_id: userResult[0].id,
      wallet_type: 'BINANCE_SMART_CHAIN'
      // is_primary not specified
    };

    const result = await createWallet(input);

    expect(result.is_primary).toEqual(false);
  });

  it('should throw error when user does not exist', async () => {
    const input: CreateWalletInput = {
      user_id: 99999, // Non-existent user ID
      wallet_type: 'ETHEREUM',
      is_primary: false
    };

    await expect(createWallet(input)).rejects.toThrow(/User with ID 99999 not found/i);
  });

  it('should create multiple wallets for same user with different types', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create multiple wallets
    const ethereumWallet = await createWallet({
      user_id: userResult[0].id,
      wallet_type: 'ETHEREUM'
    });

    const bitcoinWallet = await createWallet({
      user_id: userResult[0].id,
      wallet_type: 'BITCOIN'
    });

    const polygonWallet = await createWallet({
      user_id: userResult[0].id,
      wallet_type: 'POLYGON'
    });

    // Query all wallets for this user
    const userWallets = await db.select()
      .from(walletsTable)
      .where(eq(walletsTable.user_id, userResult[0].id))
      .execute();

    expect(userWallets).toHaveLength(3);
    
    const walletTypes = userWallets.map(w => w.wallet_type);
    expect(walletTypes).toContain('ETHEREUM');
    expect(walletTypes).toContain('BITCOIN');
    expect(walletTypes).toContain('POLYGON');

    // All wallets should have unique addresses
    const addresses = userWallets.map(w => w.wallet_address);
    expect(new Set(addresses).size).toEqual(3);
  });
});