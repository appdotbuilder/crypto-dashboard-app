import { db } from '../db';
import { 
  portfolioTable, 
  transactionsTable, 
  cryptoAssetsTable,
  usersTable 
} from '../db/schema';
import { type TradingDashboard } from '../schema';
import { eq, desc, and } from 'drizzle-orm';

export const getTradingDashboard = async (userId: number): Promise<TradingDashboard> => {
  try {
    // Verify user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Get user's portfolio breakdown
    const portfolioBreakdown = await db.select()
      .from(portfolioTable)
      .where(eq(portfolioTable.user_id, userId))
      .execute();

    // Convert numeric fields to numbers
    const portfolioData = portfolioBreakdown.map(item => ({
      ...item,
      amount: parseFloat(item.amount),
      average_buy_price: parseFloat(item.average_buy_price),
      current_value: parseFloat(item.current_value),
      profit_loss: parseFloat(item.profit_loss),
      profit_loss_percentage: parseFloat(item.profit_loss_percentage)
    }));

    // Calculate total portfolio metrics
    const totalPortfolioValue = portfolioData.reduce((sum, item) => sum + item.current_value, 0);
    const totalProfitLoss = portfolioData.reduce((sum, item) => sum + item.profit_loss, 0);
    const totalInvestment = totalPortfolioValue - totalProfitLoss;
    const totalProfitLossPercentage = totalInvestment !== 0 ? (totalProfitLoss / totalInvestment) * 100 : 0;

    // Find top and worst performing assets
    const sortedByPerformance = [...portfolioData].sort((a, b) => b.profit_loss_percentage - a.profit_loss_percentage);
    const topPerformingAsset = sortedByPerformance.length > 0 ? sortedByPerformance[0].asset_symbol : null;
    const worstPerformingAsset = sortedByPerformance.length > 0 ? sortedByPerformance[sortedByPerformance.length - 1].asset_symbol : null;

    // Get recent transactions (last 10)
    const recentTransactionsQuery = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.user_id, userId))
      .orderBy(desc(transactionsTable.created_at))
      .limit(10)
      .execute();

    // Convert numeric fields for transactions
    const recentTransactions = recentTransactionsQuery.map(transaction => ({
      ...transaction,
      amount: parseFloat(transaction.amount),
      price_per_unit: parseFloat(transaction.price_per_unit),
      total_value: parseFloat(transaction.total_value),
      fee: parseFloat(transaction.fee)
    }));

    // Get watchlist (all crypto assets for now - in a real app, this would be user-specific)
    const watchlistQuery = await db.select()
      .from(cryptoAssetsTable)
      .orderBy(desc(cryptoAssetsTable.market_cap))
      .limit(10)
      .execute();

    // Convert numeric fields for watchlist
    const watchlist = watchlistQuery.map(asset => ({
      ...asset,
      current_price: parseFloat(asset.current_price),
      price_change_24h: parseFloat(asset.price_change_24h),
      price_change_percentage_24h: parseFloat(asset.price_change_percentage_24h),
      market_cap: parseFloat(asset.market_cap),
      volume_24h: parseFloat(asset.volume_24h)
    }));

    return {
      user_id: userId,
      total_portfolio_value: Math.round(totalPortfolioValue * 100) / 100,
      total_profit_loss: Math.round(totalProfitLoss * 100) / 100,
      total_profit_loss_percentage: Math.round(totalProfitLossPercentage * 100) / 100,
      top_performing_asset: topPerformingAsset,
      worst_performing_asset: worstPerformingAsset,
      recent_transactions: recentTransactions,
      portfolio_breakdown: portfolioData,
      watchlist: watchlist
    };

  } catch (error) {
    console.error('Trading dashboard fetch failed:', error);
    throw error;
  }
};