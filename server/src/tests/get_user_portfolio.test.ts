import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, portfolioTable, cryptoAssetsTable } from '../db/schema';
import { getUserPortfolio } from '../handlers/get_user_portfolio';
import { eq } from 'drizzle-orm';

describe('getUserPortfolio', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array for user with no portfolio', async () => {
    // Create a user but no portfolio entries
    const [user] = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        full_name: 'Test User',
        is_verified: true
      })
      .returning()
      .execute();

    const result = await getUserPortfolio(user.id);

    expect(result).toEqual([]);
  });

  it('should calculate portfolio metrics correctly for single asset', async () => {
    // Create user
    const [user] = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        full_name: 'Test User',
        is_verified: true
      })
      .returning()
      .execute();

    // Create crypto asset
    await db.insert(cryptoAssetsTable)
      .values({
        symbol: 'BTC',
        name: 'Bitcoin',
        current_price: '45000.00', // Current price higher than buy price
        price_change_24h: '1500.00',
        price_change_percentage_24h: '3.45',
        market_cap: '850000000000.00',
        volume_24h: '25000000000.00'
      })
      .execute();

    // Create portfolio entry
    await db.insert(portfolioTable)
      .values({
        user_id: user.id,
        asset_symbol: 'BTC',
        amount: '1.00000000', // 1 BTC
        average_buy_price: '40000.00', // Bought at $40,000
        current_value: '0.00', // Will be recalculated
        profit_loss: '0.00', // Will be recalculated
        profit_loss_percentage: '0.0000' // Will be recalculated
      })
      .execute();

    const result = await getUserPortfolio(user.id);

    expect(result).toHaveLength(1);
    expect(result[0].asset_symbol).toBe('BTC');
    expect(result[0].amount).toBe(1.0);
    expect(result[0].average_buy_price).toBe(40000.0);
    expect(result[0].current_value).toBe(45000.0); // 1 * 45000
    expect(result[0].profit_loss).toBe(5000.0); // 45000 - 40000
    expect(result[0].profit_loss_percentage).toBe(12.5); // (5000 / 40000) * 100
    expect(result[0].user_id).toBe(user.id);
    expect(result[0].id).toBeDefined();
    expect(result[0].last_updated).toBeInstanceOf(Date);
  });

  it('should handle multiple assets with different profit/loss scenarios', async () => {
    // Create user
    const [user] = await db.insert(usersTable)
      .values({
        email: 'trader@example.com',
        password_hash: 'hashed_password',
        full_name: 'Crypto Trader',
        is_verified: true
      })
      .returning()
      .execute();

    // Create multiple crypto assets
    await db.insert(cryptoAssetsTable)
      .values([
        {
          symbol: 'BTC',
          name: 'Bitcoin',
          current_price: '42000.00', // Profitable
          price_change_24h: '-1000.00',
          price_change_percentage_24h: '-2.33',
          market_cap: '800000000000.00',
          volume_24h: '20000000000.00'
        },
        {
          symbol: 'ETH',
          name: 'Ethereum',
          current_price: '2600.00', // Loss
          price_change_24h: '-150.00',
          price_change_percentage_24h: '-5.45',
          market_cap: '300000000000.00',
          volume_24h: '15000000000.00'
        },
        {
          symbol: 'ADA',
          name: 'Cardano',
          current_price: '0.50000000', // Break even
          price_change_24h: '0.00',
          price_change_percentage_24h: '0.0000',
          market_cap: '15000000000.00',
          volume_24h: '500000000.00'
        }
      ])
      .execute();

    // Create portfolio entries
    await db.insert(portfolioTable)
      .values([
        {
          user_id: user.id,
          asset_symbol: 'BTC',
          amount: '0.50000000', // 0.5 BTC at $40,000 = $20,000 invested
          average_buy_price: '40000.00',
          current_value: '0.00',
          profit_loss: '0.00',
          profit_loss_percentage: '0.0000'
        },
        {
          user_id: user.id,
          asset_symbol: 'ETH',
          amount: '5.00000000', // 5 ETH at $3,000 = $15,000 invested
          average_buy_price: '3000.00',
          current_value: '0.00',
          profit_loss: '0.00',
          profit_loss_percentage: '0.0000'
        },
        {
          user_id: user.id,
          asset_symbol: 'ADA',
          amount: '10000.00000000', // 10,000 ADA at $0.50 = $5,000 invested
          average_buy_price: '0.50000000',
          current_value: '0.00',
          profit_loss: '0.00',
          profit_loss_percentage: '0.0000'
        }
      ])
      .execute();

    const result = await getUserPortfolio(user.id);

    expect(result).toHaveLength(3);

    // Find each asset in results
    const btcPortfolio = result.find(p => p.asset_symbol === 'BTC');
    const ethPortfolio = result.find(p => p.asset_symbol === 'ETH');
    const adaPortfolio = result.find(p => p.asset_symbol === 'ADA');

    expect(btcPortfolio).toBeDefined();
    expect(btcPortfolio!.current_value).toBe(21000.0); // 0.5 * 42000
    expect(btcPortfolio!.profit_loss).toBe(1000.0); // 21000 - 20000
    expect(btcPortfolio!.profit_loss_percentage).toBe(5.0); // (1000 / 20000) * 100

    expect(ethPortfolio).toBeDefined();
    expect(ethPortfolio!.current_value).toBe(13000.0); // 5 * 2600
    expect(ethPortfolio!.profit_loss).toBe(-2000.0); // 13000 - 15000
    expect(ethPortfolio!.profit_loss_percentage).toBeCloseTo(-13.33, 2); // (-2000 / 15000) * 100

    expect(adaPortfolio).toBeDefined();
    expect(adaPortfolio!.current_value).toBe(5000.0); // 10000 * 0.5
    expect(adaPortfolio!.profit_loss).toBe(0.0); // 5000 - 5000
    expect(adaPortfolio!.profit_loss_percentage).toBe(0.0); // (0 / 5000) * 100
  });

  it('should handle zero invested amount correctly', async () => {
    // Create user
    const [user] = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        full_name: 'Test User',
        is_verified: true
      })
      .returning()
      .execute();

    // Create crypto asset
    await db.insert(cryptoAssetsTable)
      .values({
        symbol: 'FREE',
        name: 'Free Token',
        current_price: '100.00',
        price_change_24h: '5.00',
        price_change_percentage_24h: '5.26',
        market_cap: '1000000.00',
        volume_24h: '50000.00'
      })
      .execute();

    // Create portfolio entry with zero buy price (free tokens)
    await db.insert(portfolioTable)
      .values({
        user_id: user.id,
        asset_symbol: 'FREE',
        amount: '10.00000000', // 10 tokens received for free
        average_buy_price: '0.00000000', // Free tokens
        current_value: '0.00',
        profit_loss: '0.00',
        profit_loss_percentage: '0.0000'
      })
      .execute();

    const result = await getUserPortfolio(user.id);

    expect(result).toHaveLength(1);
    expect(result[0].current_value).toBe(1000.0); // 10 * 100
    expect(result[0].profit_loss).toBe(1000.0); // 1000 - 0
    expect(result[0].profit_loss_percentage).toBe(0.0); // Division by zero handled
  });

  it('should only return portfolio for specified user', async () => {
    // Create two users
    const [user1] = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        password_hash: 'hashed_password',
        full_name: 'User One',
        is_verified: true
      })
      .returning()
      .execute();

    const [user2] = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        password_hash: 'hashed_password',
        full_name: 'User Two',
        is_verified: true
      })
      .returning()
      .execute();

    // Create crypto asset
    await db.insert(cryptoAssetsTable)
      .values({
        symbol: 'BTC',
        name: 'Bitcoin',
        current_price: '43000.00',
        price_change_24h: '500.00',
        price_change_percentage_24h: '1.18',
        market_cap: '820000000000.00',
        volume_24h: '18000000000.00'
      })
      .execute();

    // Create portfolio entries for both users
    await db.insert(portfolioTable)
      .values([
        {
          user_id: user1.id,
          asset_symbol: 'BTC',
          amount: '1.00000000',
          average_buy_price: '40000.00',
          current_value: '0.00',
          profit_loss: '0.00',
          profit_loss_percentage: '0.0000'
        },
        {
          user_id: user2.id,
          asset_symbol: 'BTC',
          amount: '2.00000000',
          average_buy_price: '41000.00',
          current_value: '0.00',
          profit_loss: '0.00',
          profit_loss_percentage: '0.0000'
        }
      ])
      .execute();

    // Get portfolio for user1 only
    const result = await getUserPortfolio(user1.id);

    expect(result).toHaveLength(1);
    expect(result[0].user_id).toBe(user1.id);
    expect(result[0].amount).toBe(1.0); // Only user1's portfolio
  });

  it('should convert all numeric fields correctly from database', async () => {
    // Create user
    const [user] = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        full_name: 'Test User',
        is_verified: true
      })
      .returning()
      .execute();

    // Create crypto asset with decimal values
    await db.insert(cryptoAssetsTable)
      .values({
        symbol: 'ETH',
        name: 'Ethereum',
        current_price: '2847.52300000', // Precise decimal price
        price_change_24h: '73.42000000',
        price_change_percentage_24h: '2.6500',
        market_cap: '342500000000.00',
        volume_24h: '12500000000.00'
      })
      .execute();

    // Create portfolio with precise decimal values
    await db.insert(portfolioTable)
      .values({
        user_id: user.id,
        asset_symbol: 'ETH',
        amount: '1.23456789', // Precise amount
        average_buy_price: '2750.00000000', // Precise buy price
        current_value: '0.00',
        profit_loss: '0.00',
        profit_loss_percentage: '0.0000'
      })
      .execute();

    const result = await getUserPortfolio(user.id);

    expect(result).toHaveLength(1);
    
    // Verify all numeric conversions are correct
    expect(typeof result[0].amount).toBe('number');
    expect(typeof result[0].average_buy_price).toBe('number');
    expect(typeof result[0].current_value).toBe('number');
    expect(typeof result[0].profit_loss).toBe('number');
    expect(typeof result[0].profit_loss_percentage).toBe('number');

    // Verify precise calculations
    expect(result[0].amount).toBeCloseTo(1.23456789, 8);
    expect(result[0].average_buy_price).toBe(2750.0);
    expect(result[0].current_value).toBeCloseTo(3515.46, 1); // 1.23456789 * 2847.523
    expect(result[0].profit_loss).toBeCloseTo(120.40, 1); // current_value - invested_amount
  });
});