import { db } from '../db';
import { cryptoAssetsTable } from '../db/schema';
import { type CryptoAsset } from '../schema';
import { desc } from 'drizzle-orm';

export const getCryptoAssets = async (): Promise<CryptoAsset[]> => {
  try {
    // Fetch all crypto assets ordered by market cap (descending)
    const results = await db.select()
      .from(cryptoAssetsTable)
      .orderBy(desc(cryptoAssetsTable.market_cap))
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(asset => ({
      ...asset,
      current_price: parseFloat(asset.current_price),
      price_change_24h: parseFloat(asset.price_change_24h),
      price_change_percentage_24h: parseFloat(asset.price_change_percentage_24h),
      market_cap: parseFloat(asset.market_cap),
      volume_24h: parseFloat(asset.volume_24h)
    }));
  } catch (error) {
    console.error('Failed to fetch crypto assets:', error);
    throw error;
  }
};