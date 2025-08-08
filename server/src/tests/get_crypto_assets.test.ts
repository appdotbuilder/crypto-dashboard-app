import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { cryptoAssetsTable } from '../db/schema';
import { getCryptoAssets } from '../handlers/get_crypto_assets';

describe('getCryptoAssets', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no crypto assets exist', async () => {
    const result = await getCryptoAssets();
    
    expect(result).toEqual([]);
  });

  it('should return all crypto assets with proper numeric conversions', async () => {
    // Create test crypto assets
    const testAssets = [
      {
        symbol: 'BTC',
        name: 'Bitcoin',
        current_price: '43250.80',
        price_change_24h: '1250.30',
        price_change_percentage_24h: '2.98',
        market_cap: '847000000000',
        volume_24h: '28500000000'
      },
      {
        symbol: 'ETH',
        name: 'Ethereum',
        current_price: '2650.45',
        price_change_24h: '-125.80',
        price_change_percentage_24h: '-4.53',
        market_cap: '318000000000',
        volume_24h: '15800000000'
      }
    ];

    await db.insert(cryptoAssetsTable)
      .values(testAssets)
      .execute();

    const result = await getCryptoAssets();

    expect(result).toHaveLength(2);
    
    // Verify first asset (Bitcoin - higher market cap should be first)
    const btc = result[0];
    expect(btc.symbol).toBe('BTC');
    expect(btc.name).toBe('Bitcoin');
    expect(typeof btc.current_price).toBe('number');
    expect(btc.current_price).toBe(43250.80);
    expect(typeof btc.price_change_24h).toBe('number');
    expect(btc.price_change_24h).toBe(1250.30);
    expect(typeof btc.price_change_percentage_24h).toBe('number');
    expect(btc.price_change_percentage_24h).toBe(2.98);
    expect(typeof btc.market_cap).toBe('number');
    expect(btc.market_cap).toBe(847000000000);
    expect(typeof btc.volume_24h).toBe('number');
    expect(btc.volume_24h).toBe(28500000000);
    expect(btc.id).toBeDefined();
    expect(btc.last_updated).toBeInstanceOf(Date);
    
    // Verify second asset (Ethereum)
    const eth = result[1];
    expect(eth.symbol).toBe('ETH');
    expect(eth.name).toBe('Ethereum');
    expect(typeof eth.price_change_24h).toBe('number');
    expect(eth.price_change_24h).toBe(-125.80);
    expect(typeof eth.price_change_percentage_24h).toBe('number');
    expect(eth.price_change_percentage_24h).toBe(-4.53);
  });

  it('should order assets by market cap descending', async () => {
    // Create test assets with different market caps
    const testAssets = [
      {
        symbol: 'SMALL',
        name: 'Small Coin',
        current_price: '1.00',
        price_change_24h: '0.00',
        price_change_percentage_24h: '0.00',
        market_cap: '1000000', // Smallest
        volume_24h: '100000'
      },
      {
        symbol: 'LARGE',
        name: 'Large Coin',
        current_price: '50000.00',
        price_change_24h: '0.00',
        price_change_percentage_24h: '0.00',
        market_cap: '1000000000000', // Largest
        volume_24h: '1000000000'
      },
      {
        symbol: 'MID',
        name: 'Mid Coin',
        current_price: '100.00',
        price_change_24h: '0.00',
        price_change_percentage_24h: '0.00',
        market_cap: '10000000000', // Middle
        volume_24h: '10000000'
      }
    ];

    await db.insert(cryptoAssetsTable)
      .values(testAssets)
      .execute();

    const result = await getCryptoAssets();

    expect(result).toHaveLength(3);
    expect(result[0].symbol).toBe('LARGE'); // Highest market cap first
    expect(result[1].symbol).toBe('MID');   // Middle market cap second
    expect(result[2].symbol).toBe('SMALL'); // Lowest market cap last
    
    // Verify market caps are properly ordered
    expect(result[0].market_cap).toBeGreaterThan(result[1].market_cap);
    expect(result[1].market_cap).toBeGreaterThan(result[2].market_cap);
  });

  it('should handle single crypto asset correctly', async () => {
    const testAsset = {
      symbol: 'BTC',
      name: 'Bitcoin',
      current_price: '43250.80',
      price_change_24h: '1250.30',
      price_change_percentage_24h: '2.98',
      market_cap: '847000000000',
      volume_24h: '28500000000'
    };

    await db.insert(cryptoAssetsTable)
      .values(testAsset)
      .execute();

    const result = await getCryptoAssets();

    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('BTC');
    expect(result[0].current_price).toBe(43250.80);
    expect(result[0].market_cap).toBe(847000000000);
  });

  it('should handle assets with zero or negative values correctly', async () => {
    const testAsset = {
      symbol: 'TEST',
      name: 'Test Coin',
      current_price: '0.00001',
      price_change_24h: '-0.000005',
      price_change_percentage_24h: '-33.33',
      market_cap: '1000',
      volume_24h: '0'
    };

    await db.insert(cryptoAssetsTable)
      .values(testAsset)
      .execute();

    const result = await getCryptoAssets();

    expect(result).toHaveLength(1);
    expect(result[0].current_price).toBe(0.00001);
    expect(result[0].price_change_24h).toBe(-0.000005);
    expect(result[0].price_change_percentage_24h).toBe(-33.33);
    expect(result[0].volume_24h).toBe(0);
  });
});