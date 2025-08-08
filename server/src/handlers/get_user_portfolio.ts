import { db } from '../db';
import { portfolioTable, cryptoAssetsTable } from '../db/schema';
import { type Portfolio } from '../schema';
import { eq } from 'drizzle-orm';

export const getUserPortfolio = async (userId: number): Promise<Portfolio[]> => {
  try {
    // Join portfolio with crypto assets to get current prices
    const results = await db.select()
      .from(portfolioTable)
      .innerJoin(cryptoAssetsTable, eq(portfolioTable.asset_symbol, cryptoAssetsTable.symbol))
      .where(eq(portfolioTable.user_id, userId))
      .execute();

    // Calculate portfolio metrics with current prices
    return results.map(result => {
      const portfolioEntry = result.portfolio;
      const cryptoAsset = result.crypto_assets;

      // Convert numeric fields from database strings to numbers
      const amount = parseFloat(portfolioEntry.amount);
      const averageBuyPrice = parseFloat(portfolioEntry.average_buy_price);
      const currentPrice = parseFloat(cryptoAsset.current_price);

      // Calculate current portfolio values
      const currentValue = amount * currentPrice;
      const investedAmount = amount * averageBuyPrice;
      const profitLoss = currentValue - investedAmount;
      const profitLossPercentage = investedAmount > 0 ? (profitLoss / investedAmount) * 100 : 0;

      return {
        id: portfolioEntry.id,
        user_id: portfolioEntry.user_id,
        asset_symbol: portfolioEntry.asset_symbol,
        amount: amount,
        average_buy_price: averageBuyPrice,
        current_value: currentValue,
        profit_loss: profitLoss,
        profit_loss_percentage: profitLossPercentage,
        last_updated: portfolioEntry.last_updated
      };
    });
  } catch (error) {
    console.error('Failed to fetch user portfolio:', error);
    throw error;
  }
};