import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, walletsTable, cryptoAssetsTable, portfolioTable, transactionsTable } from '../db/schema';
import { type BuyOrderInput } from '../schema';
import { executeBuyOrder } from '../handlers/execute_buy_order';
import { eq, and } from 'drizzle-orm';

describe('executeBuyOrder', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test data setup
  let testUser: any;
  let testWallet: any;
  let testAsset: any;

  const setupTestData = async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'trader@test.com',
        password_hash: 'hashed_password',
        full_name: 'Test Trader',
        is_verified: true
      })
      .returning()
      .execute();
    
    testUser = userResult[0];

    // Create test wallet with sufficient balance
    const walletResult = await db.insert(walletsTable)
      .values({
        user_id: testUser.id,
        wallet_address: '0x1234567890abcdef',
        wallet_type: 'ETHEREUM',
        balance: '10000.00000000', // $10,000 balance
        is_primary: true
      })
      .returning()
      .execute();
    
    testWallet = walletResult[0];

    // Create test crypto asset
    const assetResult = await db.insert(cryptoAssetsTable)
      .values({
        symbol: 'BTC',
        name: 'Bitcoin',
        current_price: '43250.80000000',
        price_change_24h: '1250.50000000',
        price_change_percentage_24h: '2.9800',
        market_cap: '850000000000.00',
        volume_24h: '25000000000.00'
      })
      .returning()
      .execute();
    
    testAsset = assetResult[0];
  };

  const testMarketOrderInput: BuyOrderInput = {
    user_id: 0, // Will be set in tests
    wallet_id: 0, // Will be set in tests
    asset_symbol: 'BTC',
    amount: 0.1, // 0.1 BTC
    order_type: 'MARKET'
  };

  const testLimitOrderInput: BuyOrderInput = {
    user_id: 0, // Will be set in tests
    wallet_id: 0, // Will be set in tests
    asset_symbol: 'BTC',
    amount: 0.05, // 0.05 BTC
    order_type: 'LIMIT',
    limit_price: 42000.00
  };

  it('should execute market buy order successfully', async () => {
    await setupTestData();
    
    const input: BuyOrderInput = {
      ...testMarketOrderInput,
      user_id: testUser.id,
      wallet_id: testWallet.id
    };

    const result = await executeBuyOrder(input);

    // Verify transaction details
    expect(result.user_id).toEqual(testUser.id);
    expect(result.wallet_id).toEqual(testWallet.id);
    expect(result.transaction_type).toEqual('BUY');
    expect(result.asset_symbol).toEqual('BTC');
    expect(result.amount).toEqual(0.1);
    expect(result.price_per_unit).toEqual(43250.8);
    
    // Calculate expected values to match handler logic
    const expectedSubtotal = 0.1 * 43250.8; // 4325.08
    const expectedFee = expectedSubtotal * 0.001; // 4.32508
    const expectedTotal = expectedSubtotal + expectedFee; // 4329.40508
    
    expect(result.fee).toBeCloseTo(expectedFee, 2);
    expect(result.total_value).toBeCloseTo(expectedTotal, 2);
    expect(result.status).toEqual('COMPLETED');
    expect(result.transaction_hash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.completed_at).toBeInstanceOf(Date);
  });

  it('should execute limit buy order successfully', async () => {
    await setupTestData();
    
    const input: BuyOrderInput = {
      ...testLimitOrderInput,
      user_id: testUser.id,
      wallet_id: testWallet.id
    };

    const result = await executeBuyOrder(input);

    // Verify transaction details
    expect(result.user_id).toEqual(testUser.id);
    expect(result.wallet_id).toEqual(testWallet.id);
    expect(result.transaction_type).toEqual('BUY');
    expect(result.asset_symbol).toEqual('BTC');
    expect(result.amount).toEqual(0.05);
    expect(result.price_per_unit).toEqual(42000.00); // Limit price used
    // Calculate expected values to match handler logic
    const expectedSubtotal = 0.05 * 42000.00; // 2100
    const expectedFee = expectedSubtotal * 0.001; // 2.1
    const expectedTotal = expectedSubtotal + expectedFee; // 2102.1
    
    expect(result.fee).toBeCloseTo(expectedFee, 2);
    expect(result.total_value).toBeCloseTo(expectedTotal, 2);
    expect(result.status).toEqual('COMPLETED');
  });

  it('should update wallet balance correctly', async () => {
    await setupTestData();
    
    const input: BuyOrderInput = {
      ...testMarketOrderInput,
      user_id: testUser.id,
      wallet_id: testWallet.id
    };

    const initialBalance = parseFloat(testWallet.balance);
    const result = await executeBuyOrder(input);

    // Check updated wallet balance
    const updatedWallets = await db.select()
      .from(walletsTable)
      .where(eq(walletsTable.id, testWallet.id))
      .execute();

    const updatedBalance = parseFloat(updatedWallets[0].balance);
    // Use the actual total_value from the transaction result
    const expectedBalance = initialBalance - result.total_value;
    
    expect(updatedBalance).toBeCloseTo(expectedBalance, 2);
    expect(updatedWallets[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create new portfolio entry for new asset', async () => {
    await setupTestData();
    
    const input: BuyOrderInput = {
      ...testMarketOrderInput,
      user_id: testUser.id,
      wallet_id: testWallet.id
    };

    await executeBuyOrder(input);

    // Check portfolio entry
    const portfolioEntries = await db.select()
      .from(portfolioTable)
      .where(and(
        eq(portfolioTable.user_id, testUser.id),
        eq(portfolioTable.asset_symbol, 'BTC')
      ))
      .execute();

    expect(portfolioEntries).toHaveLength(1);
    
    const portfolio = portfolioEntries[0];
    expect(parseFloat(portfolio.amount)).toBeCloseTo(0.1, 8);
    expect(parseFloat(portfolio.average_buy_price)).toBeCloseTo(43250.8, 2);
    expect(parseFloat(portfolio.current_value)).toBeCloseTo(4325.08, 2); // amount * current_price
    expect(parseFloat(portfolio.profit_loss)).toBeCloseTo(0, 2); // current_value - (amount * avg_buy_price)
    expect(parseFloat(portfolio.profit_loss_percentage)).toBeCloseTo(0, 2);
  });

  it('should update existing portfolio entry correctly', async () => {
    await setupTestData();
    
    // Create existing portfolio entry
    await db.insert(portfolioTable)
      .values({
        user_id: testUser.id,
        asset_symbol: 'BTC',
        amount: '0.05',
        average_buy_price: '40000.00000000',
        current_value: '2000.00000000',
        profit_loss: '0.00000000',
        profit_loss_percentage: '0.0000'
      })
      .execute();

    const input: BuyOrderInput = {
      ...testMarketOrderInput,
      user_id: testUser.id,
      wallet_id: testWallet.id
    };

    await executeBuyOrder(input);

    // Check updated portfolio entry
    const portfolioEntries = await db.select()
      .from(portfolioTable)
      .where(and(
        eq(portfolioTable.user_id, testUser.id),
        eq(portfolioTable.asset_symbol, 'BTC')
      ))
      .execute();

    expect(portfolioEntries).toHaveLength(1);
    
    const portfolio = portfolioEntries[0];
    expect(parseFloat(portfolio.amount)).toBeCloseTo(0.15, 8); // 0.05 + 0.1
    
    // Calculate expected average buy price
    // (0.05 * 40000 + 0.1 * 43250.8) / 0.15 = (2000 + 4325.08) / 0.15 = 42167.2
    expect(parseFloat(portfolio.average_buy_price)).toBeCloseTo(42167.2, 1);
    
    // Current value should be total amount * current market price
    expect(parseFloat(portfolio.current_value)).toBeCloseTo(6487.62, 2); // 0.15 * 43250.8
  });

  it('should save transaction to database', async () => {
    await setupTestData();
    
    const input: BuyOrderInput = {
      ...testMarketOrderInput,
      user_id: testUser.id,
      wallet_id: testWallet.id
    };

    const result = await executeBuyOrder(input);

    // Verify transaction was saved
    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, result.id))
      .execute();

    expect(transactions).toHaveLength(1);
    
    const savedTransaction = transactions[0];
    expect(savedTransaction.user_id).toEqual(testUser.id);
    expect(savedTransaction.wallet_id).toEqual(testWallet.id);
    expect(savedTransaction.transaction_type).toEqual('BUY');
    expect(parseFloat(savedTransaction.amount)).toBeCloseTo(0.1, 8);
    expect(savedTransaction.status).toEqual('COMPLETED');
  });

  it('should throw error for non-existent wallet', async () => {
    await setupTestData();
    
    const input: BuyOrderInput = {
      ...testMarketOrderInput,
      user_id: testUser.id,
      wallet_id: 99999 // Non-existent wallet
    };

    expect(executeBuyOrder(input)).rejects.toThrow(/wallet not found/i);
  });

  it('should throw error for wallet belonging to different user', async () => {
    await setupTestData();
    
    // Create another user
    const anotherUserResult = await db.insert(usersTable)
      .values({
        email: 'other@test.com',
        password_hash: 'hashed_password',
        full_name: 'Other User',
        is_verified: true
      })
      .returning()
      .execute();

    const input: BuyOrderInput = {
      ...testMarketOrderInput,
      user_id: anotherUserResult[0].id, // Different user
      wallet_id: testWallet.id // Wallet belongs to testUser
    };

    expect(executeBuyOrder(input)).rejects.toThrow(/wallet not found/i);
  });

  it('should throw error for non-existent asset', async () => {
    await setupTestData();
    
    const input: BuyOrderInput = {
      ...testMarketOrderInput,
      user_id: testUser.id,
      wallet_id: testWallet.id,
      asset_symbol: 'INVALID' // Non-existent asset
    };

    expect(executeBuyOrder(input)).rejects.toThrow(/asset invalid not found/i);
  });

  it('should throw error for insufficient wallet balance', async () => {
    await setupTestData();
    
    // Update wallet to have insufficient balance
    await db.update(walletsTable)
      .set({ balance: '100.00000000' }) // Only $100
      .where(eq(walletsTable.id, testWallet.id))
      .execute();

    const input: BuyOrderInput = {
      ...testMarketOrderInput,
      user_id: testUser.id,
      wallet_id: testWallet.id,
      amount: 1.0 // 1 BTC would cost ~$43,250
    };

    expect(executeBuyOrder(input)).rejects.toThrow(/insufficient balance/i);
  });

  it('should throw error for limit order without limit price', async () => {
    await setupTestData();
    
    const input: BuyOrderInput = {
      user_id: testUser.id,
      wallet_id: testWallet.id,
      asset_symbol: 'BTC',
      amount: 0.1,
      order_type: 'LIMIT'
      // Missing limit_price
    };

    expect(executeBuyOrder(input)).rejects.toThrow(/limit price is required/i);
  });

  it('should calculate fees correctly', async () => {
    await setupTestData();
    
    // Update wallet to have sufficient balance for this test
    await db.update(walletsTable)
      .set({ balance: '50000.00000000' }) // $50,000 balance
      .where(eq(walletsTable.id, testWallet.id))
      .execute();
    
    const input: BuyOrderInput = {
      ...testLimitOrderInput,
      user_id: testUser.id,
      wallet_id: testWallet.id,
      amount: 1.0, // 1 BTC at $42,000
      limit_price: 42000.00
    };

    const result = await executeBuyOrder(input);

    const expectedSubtotal = 1.0 * 42000.00; // $42,000
    const expectedFee = expectedSubtotal * 0.001; // 0.1% = $42
    const expectedTotal = expectedSubtotal + expectedFee; // $42,042

    expect(result.fee).toBeCloseTo(expectedFee, 2);
    expect(result.total_value).toBeCloseTo(expectedTotal, 2);
  });
});