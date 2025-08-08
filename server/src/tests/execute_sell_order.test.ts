import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, walletsTable, cryptoAssetsTable, portfolioTable, transactionsTable } from '../db/schema';
import { type SellOrderInput } from '../schema';
import { executeSellOrder } from '../handlers/execute_sell_order';
import { eq, and } from 'drizzle-orm';

// Test user data
const testUser = {
  email: 'testuser@example.com',
  password_hash: 'hashed_password',
  full_name: 'Test User',
  phone: '1234567890',
  is_verified: true
};

// Test crypto asset data
const testAsset = {
  symbol: 'BTC',
  name: 'Bitcoin',
  current_price: '43250.80',
  price_change_24h: '1250.30',
  price_change_percentage_24h: '2.98',
  market_cap: '850000000000.00',
  volume_24h: '25000000000.00'
};

// Test wallet data
const testWallet = {
  wallet_address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  wallet_type: 'BITCOIN' as const,
  balance: '10000.00',
  is_primary: true
};

// Test portfolio data
const testPortfolio = {
  asset_symbol: 'BTC',
  amount: '0.5',
  average_buy_price: '40000.00',
  current_value: '21625.40',
  profit_loss: '1625.40',
  profit_loss_percentage: '8.13'
};

describe('executeSellOrder', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let userId: number;
  let walletId: number;

  beforeEach(async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create test crypto asset
    await db.insert(cryptoAssetsTable)
      .values(testAsset)
      .execute();

    // Create test wallet
    const walletResult = await db.insert(walletsTable)
      .values({
        ...testWallet,
        user_id: userId
      })
      .returning()
      .execute();
    walletId = walletResult[0].id;

    // Create test portfolio
    await db.insert(portfolioTable)
      .values({
        ...testPortfolio,
        user_id: userId
      })
      .execute();
  });

  it('should execute market sell order successfully', async () => {
    const sellInput: SellOrderInput = {
      user_id: userId,
      wallet_id: walletId,
      asset_symbol: 'BTC',
      amount: 0.25,
      order_type: 'MARKET'
    };

    const result = await executeSellOrder(sellInput);

    // Verify transaction fields
    expect(result.user_id).toBe(userId);
    expect(result.wallet_id).toBe(walletId);
    expect(result.transaction_type).toBe('SELL');
    expect(result.asset_symbol).toBe('BTC');
    expect(result.amount).toBe(0.25);
    expect(result.price_per_unit).toBe(43250.80);
    expect(result.status).toBe('COMPLETED');
    expect(result.transaction_hash).toBeDefined();
    expect(result.completed_at).toBeDefined();

    // Verify calculated values
    const expectedTotalValue = 0.25 * 43250.80; // 10812.70
    const expectedFee = expectedTotalValue * 0.001; // 10.8127
    const expectedNetProceeds = expectedTotalValue - expectedFee; // 10801.8873

    expect(result.total_value).toBeCloseTo(expectedTotalValue, 2);
    expect(result.fee).toBeCloseTo(expectedFee, 4);

    // Verify portfolio was updated
    const portfolio = await db.select()
      .from(portfolioTable)
      .where(and(
        eq(portfolioTable.user_id, userId),
        eq(portfolioTable.asset_symbol, 'BTC')
      ))
      .execute();

    expect(portfolio).toHaveLength(1);
    expect(parseFloat(portfolio[0].amount)).toBe(0.25); // 0.5 - 0.25 = 0.25

    // Verify wallet balance was updated
    const wallet = await db.select()
      .from(walletsTable)
      .where(eq(walletsTable.id, walletId))
      .execute();

    const expectedNewBalance = 10000 + expectedNetProceeds;
    expect(parseFloat(wallet[0].balance)).toBeCloseTo(expectedNewBalance, 2);
  });

  it('should execute limit sell order successfully', async () => {
    const sellInput: SellOrderInput = {
      user_id: userId,
      wallet_id: walletId,
      asset_symbol: 'BTC',
      amount: 0.25,
      order_type: 'LIMIT',
      limit_price: 45000.00
    };

    const result = await executeSellOrder(sellInput);

    expect(result.price_per_unit).toBe(45000.00);
    expect(result.total_value).toBeCloseTo(0.25 * 45000.00, 2);
  });

  it('should remove portfolio entry when selling entire balance', async () => {
    const sellInput: SellOrderInput = {
      user_id: userId,
      wallet_id: walletId,
      asset_symbol: 'BTC',
      amount: 0.5, // Sell entire balance
      order_type: 'MARKET'
    };

    await executeSellOrder(sellInput);

    // Verify portfolio entry was removed
    const portfolio = await db.select()
      .from(portfolioTable)
      .where(and(
        eq(portfolioTable.user_id, userId),
        eq(portfolioTable.asset_symbol, 'BTC')
      ))
      .execute();

    expect(portfolio).toHaveLength(0);
  });

  it('should save transaction to database', async () => {
    const sellInput: SellOrderInput = {
      user_id: userId,
      wallet_id: walletId,
      asset_symbol: 'BTC',
      amount: 0.25,
      order_type: 'MARKET'
    };

    const result = await executeSellOrder(sellInput);

    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, result.id))
      .execute();

    expect(transactions).toHaveLength(1);
    expect(transactions[0].transaction_type).toBe('SELL');
    expect(parseFloat(transactions[0].amount)).toBe(0.25);
    expect(transactions[0].status).toBe('COMPLETED');
  });

  it('should throw error for insufficient crypto balance', async () => {
    const sellInput: SellOrderInput = {
      user_id: userId,
      wallet_id: walletId,
      asset_symbol: 'BTC',
      amount: 1.0, // More than available 0.5
      order_type: 'MARKET'
    };

    await expect(executeSellOrder(sellInput)).rejects.toThrow(/insufficient crypto balance/i);
  });

  it('should throw error for invalid wallet', async () => {
    const sellInput: SellOrderInput = {
      user_id: userId,
      wallet_id: 99999, // Non-existent wallet
      asset_symbol: 'BTC',
      amount: 0.25,
      order_type: 'MARKET'
    };

    await expect(executeSellOrder(sellInput)).rejects.toThrow(/wallet not found/i);
  });

  it('should throw error for wallet not belonging to user', async () => {
    // Create another user and wallet
    const otherUserResult = await db.insert(usersTable)
      .values({
        email: 'other@example.com',
        password_hash: 'hashed_password',
        full_name: 'Other User',
        is_verified: true
      })
      .returning()
      .execute();

    const otherWalletResult = await db.insert(walletsTable)
      .values({
        user_id: otherUserResult[0].id,
        wallet_address: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
        wallet_type: 'BITCOIN',
        balance: '5000.00',
        is_primary: true
      })
      .returning()
      .execute();

    const sellInput: SellOrderInput = {
      user_id: userId,
      wallet_id: otherWalletResult[0].id, // Wallet belongs to other user
      asset_symbol: 'BTC',
      amount: 0.25,
      order_type: 'MARKET'
    };

    await expect(executeSellOrder(sellInput)).rejects.toThrow(/wallet not found or does not belong to user/i);
  });

  it('should throw error for non-existent asset', async () => {
    const sellInput: SellOrderInput = {
      user_id: userId,
      wallet_id: walletId,
      asset_symbol: 'NONEXISTENT',
      amount: 0.25,
      order_type: 'MARKET'
    };

    await expect(executeSellOrder(sellInput)).rejects.toThrow(/asset not found/i);
  });

  it('should throw error for no portfolio entry', async () => {
    // Create another asset without portfolio entry
    await db.insert(cryptoAssetsTable)
      .values({
        symbol: 'ETH',
        name: 'Ethereum',
        current_price: '2650.45',
        price_change_24h: '85.20',
        price_change_percentage_24h: '3.32',
        market_cap: '320000000000.00',
        volume_24h: '15000000000.00'
      })
      .execute();

    const sellInput: SellOrderInput = {
      user_id: userId,
      wallet_id: walletId,
      asset_symbol: 'ETH', // No portfolio entry for ETH
      amount: 1.0,
      order_type: 'MARKET'
    };

    await expect(executeSellOrder(sellInput)).rejects.toThrow(/no portfolio entry found/i);
  });

  it('should throw error for invalid limit price', async () => {
    const sellInput: SellOrderInput = {
      user_id: userId,
      wallet_id: walletId,
      asset_symbol: 'BTC',
      amount: 0.25,
      order_type: 'LIMIT',
      limit_price: -100 // Invalid negative price
    };

    await expect(executeSellOrder(sellInput)).rejects.toThrow(/invalid price per unit/i);
  });

  it('should throw error for limit order without limit price', async () => {
    const sellInput: SellOrderInput = {
      user_id: userId,
      wallet_id: walletId,
      asset_symbol: 'BTC',
      amount: 0.25,
      order_type: 'LIMIT'
      // Missing limit_price
    };

    await expect(executeSellOrder(sellInput)).rejects.toThrow(/invalid price per unit/i);
  });
});