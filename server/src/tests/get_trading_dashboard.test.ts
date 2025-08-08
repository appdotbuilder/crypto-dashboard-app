import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  portfolioTable, 
  transactionsTable, 
  cryptoAssetsTable,
  walletsTable 
} from '../db/schema';
import { getTradingDashboard } from '../handlers/get_trading_dashboard';

describe('getTradingDashboard', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty dashboard for user with no portfolio', async () => {
    // Create a user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        full_name: 'Test User',
        phone: null,
        is_verified: true
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    const dashboard = await getTradingDashboard(userId);

    expect(dashboard.user_id).toBe(userId);
    expect(dashboard.total_portfolio_value).toBe(0);
    expect(dashboard.total_profit_loss).toBe(0);
    expect(dashboard.total_profit_loss_percentage).toBe(0);
    expect(dashboard.top_performing_asset).toBeNull();
    expect(dashboard.worst_performing_asset).toBeNull();
    expect(dashboard.recent_transactions).toHaveLength(0);
    expect(dashboard.portfolio_breakdown).toHaveLength(0);
    expect(dashboard.watchlist).toHaveLength(0);
  });

  it('should calculate portfolio metrics correctly', async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'trader@example.com',
        password_hash: 'hashed_password',
        full_name: 'Crypto Trader',
        phone: null,
        is_verified: true
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create crypto assets
    await db.insert(cryptoAssetsTable)
      .values([
        {
          symbol: 'BTC',
          name: 'Bitcoin',
          current_price: '50000.00',
          price_change_24h: '1000.00',
          price_change_percentage_24h: '2.04',
          market_cap: '1000000000000.00',
          volume_24h: '30000000000.00'
        },
        {
          symbol: 'ETH',
          name: 'Ethereum',
          current_price: '3000.00',
          price_change_24h: '-100.00',
          price_change_percentage_24h: '-3.23',
          market_cap: '360000000000.00',
          volume_24h: '20000000000.00'
        }
      ])
      .execute();

    // Create portfolio entries
    await db.insert(portfolioTable)
      .values([
        {
          user_id: userId,
          asset_symbol: 'BTC',
          amount: '0.1',
          average_buy_price: '45000.00',
          current_value: '5000.00', // 0.1 * 50000
          profit_loss: '500.00', // 5000 - (0.1 * 45000)
          profit_loss_percentage: '11.11' // (500 / 4500) * 100
        },
        {
          user_id: userId,
          asset_symbol: 'ETH',
          amount: '2.0',
          average_buy_price: '3200.00',
          current_value: '6000.00', // 2.0 * 3000
          profit_loss: '-400.00', // 6000 - (2.0 * 3200)
          profit_loss_percentage: '-6.25' // (-400 / 6400) * 100
        }
      ])
      .execute();

    const dashboard = await getTradingDashboard(userId);

    expect(dashboard.user_id).toBe(userId);
    expect(dashboard.total_portfolio_value).toBe(11000.00); // 5000 + 6000
    expect(dashboard.total_profit_loss).toBe(100.00); // 500 + (-400)
    expect(dashboard.total_profit_loss_percentage).toBe(0.92); // (100 / 10900) * 100
    expect(dashboard.top_performing_asset).toBe('BTC');
    expect(dashboard.worst_performing_asset).toBe('ETH');
    expect(dashboard.portfolio_breakdown).toHaveLength(2);

    // Verify portfolio data conversion
    const btcPortfolio = dashboard.portfolio_breakdown.find(p => p.asset_symbol === 'BTC');
    expect(btcPortfolio?.amount).toBe(0.1);
    expect(typeof btcPortfolio?.amount).toBe('number');
    expect(btcPortfolio?.current_value).toBe(5000.00);
    expect(typeof btcPortfolio?.current_value).toBe('number');
  });

  it('should return recent transactions with proper numeric conversions', async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'trader@example.com',
        password_hash: 'hashed_password',
        full_name: 'Crypto Trader',
        phone: null,
        is_verified: true
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create wallet
    const walletResult = await db.insert(walletsTable)
      .values({
        user_id: userId,
        wallet_address: '0x123abc...',
        wallet_type: 'ETHEREUM',
        balance: '1.5',
        is_primary: true
      })
      .returning()
      .execute();

    const walletId = walletResult[0].id;

    // Create crypto asset
    await db.insert(cryptoAssetsTable)
      .values({
        symbol: 'BTC',
        name: 'Bitcoin',
        current_price: '50000.00',
        price_change_24h: '1000.00',
        price_change_percentage_24h: '2.04',
        market_cap: '1000000000000.00',
        volume_24h: '30000000000.00'
      })
      .execute();

    // Create transactions
    await db.insert(transactionsTable)
      .values([
        {
          user_id: userId,
          wallet_id: walletId,
          transaction_type: 'BUY',
          asset_symbol: 'BTC',
          amount: '0.01',
          price_per_unit: '50000.00',
          total_value: '500.00',
          fee: '5.00',
          status: 'COMPLETED',
          transaction_hash: '0xabc123...'
        },
        {
          user_id: userId,
          wallet_id: walletId,
          transaction_type: 'SELL',
          asset_symbol: 'BTC',
          amount: '0.005',
          price_per_unit: '51000.00',
          total_value: '255.00',
          fee: '2.55',
          status: 'COMPLETED',
          transaction_hash: '0xdef456...'
        }
      ])
      .execute();

    const dashboard = await getTradingDashboard(userId);

    expect(dashboard.recent_transactions).toHaveLength(2);
    
    // Verify numeric field conversions
    const buyTransaction = dashboard.recent_transactions.find(t => t.transaction_type === 'BUY');
    expect(buyTransaction?.amount).toBe(0.01);
    expect(typeof buyTransaction?.amount).toBe('number');
    expect(buyTransaction?.price_per_unit).toBe(50000.00);
    expect(typeof buyTransaction?.price_per_unit).toBe('number');
    expect(buyTransaction?.total_value).toBe(500.00);
    expect(typeof buyTransaction?.total_value).toBe('number');
    expect(buyTransaction?.fee).toBe(5.00);
    expect(typeof buyTransaction?.fee).toBe('number');
  });

  it('should return watchlist with proper numeric conversions', async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'trader@example.com',
        password_hash: 'hashed_password',
        full_name: 'Crypto Trader',
        phone: null,
        is_verified: true
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create crypto assets for watchlist
    await db.insert(cryptoAssetsTable)
      .values([
        {
          symbol: 'BTC',
          name: 'Bitcoin',
          current_price: '50000.00',
          price_change_24h: '1000.00',
          price_change_percentage_24h: '2.04',
          market_cap: '1000000000000.00',
          volume_24h: '30000000000.00'
        },
        {
          symbol: 'ETH',
          name: 'Ethereum',
          current_price: '3000.00',
          price_change_24h: '-100.00',
          price_change_percentage_24h: '-3.23',
          market_cap: '360000000000.00',
          volume_24h: '20000000000.00'
        }
      ])
      .execute();

    const dashboard = await getTradingDashboard(userId);

    expect(dashboard.watchlist).toHaveLength(2);
    
    // Verify numeric field conversions
    const btcAsset = dashboard.watchlist.find(a => a.symbol === 'BTC');
    expect(btcAsset?.current_price).toBe(50000.00);
    expect(typeof btcAsset?.current_price).toBe('number');
    expect(btcAsset?.price_change_24h).toBe(1000.00);
    expect(typeof btcAsset?.price_change_24h).toBe('number');
    expect(btcAsset?.price_change_percentage_24h).toBe(2.04);
    expect(typeof btcAsset?.price_change_percentage_24h).toBe('number');
    expect(btcAsset?.market_cap).toBe(1000000000000.00);
    expect(typeof btcAsset?.market_cap).toBe('number');
    expect(btcAsset?.volume_24h).toBe(30000000000.00);
    expect(typeof btcAsset?.volume_24h).toBe('number');
  });

  it('should handle single asset portfolio correctly', async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'trader@example.com',
        password_hash: 'hashed_password',
        full_name: 'Crypto Trader',
        phone: null,
        is_verified: true
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create crypto asset
    await db.insert(cryptoAssetsTable)
      .values({
        symbol: 'BTC',
        name: 'Bitcoin',
        current_price: '50000.00',
        price_change_24h: '1000.00',
        price_change_percentage_24h: '2.04',
        market_cap: '1000000000000.00',
        volume_24h: '30000000000.00'
      })
      .execute();

    // Create single portfolio entry
    await db.insert(portfolioTable)
      .values({
        user_id: userId,
        asset_symbol: 'BTC',
        amount: '0.1',
        average_buy_price: '45000.00',
        current_value: '5000.00',
        profit_loss: '500.00',
        profit_loss_percentage: '11.11'
      })
      .execute();

    const dashboard = await getTradingDashboard(userId);

    expect(dashboard.top_performing_asset).toBe('BTC');
    expect(dashboard.worst_performing_asset).toBe('BTC');
    expect(dashboard.portfolio_breakdown).toHaveLength(1);
  });

  it('should throw error for non-existent user', async () => {
    const nonExistentUserId = 99999;

    await expect(getTradingDashboard(nonExistentUserId)).rejects.toThrow(/user not found/i);
  });

  it('should handle zero investment edge case', async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'trader@example.com',
        password_hash: 'hashed_password',
        full_name: 'Crypto Trader',
        phone: null,
        is_verified: true
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create crypto asset
    await db.insert(cryptoAssetsTable)
      .values({
        symbol: 'FREE',
        name: 'Free Token',
        current_price: '100.00',
        price_change_24h: '0.00',
        price_change_percentage_24h: '0.00',
        market_cap: '1000000.00',
        volume_24h: '1000.00'
      })
      .execute();

    // Create portfolio with zero average buy price (free tokens)
    await db.insert(portfolioTable)
      .values({
        user_id: userId,
        asset_symbol: 'FREE',
        amount: '10.0',
        average_buy_price: '0.00',
        current_value: '1000.00',
        profit_loss: '1000.00',
        profit_loss_percentage: '100.00'
      })
      .execute();

    const dashboard = await getTradingDashboard(userId);

    expect(dashboard.total_portfolio_value).toBe(1000.00);
    expect(dashboard.total_profit_loss).toBe(1000.00);
    expect(dashboard.total_profit_loss_percentage).toBe(0); // Should handle division by zero
  });
});