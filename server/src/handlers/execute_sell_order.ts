import { db } from '../db';
import { walletsTable, cryptoAssetsTable, portfolioTable, transactionsTable } from '../db/schema';
import { type SellOrderInput, type Transaction } from '../schema';
import { eq, and } from 'drizzle-orm';

export const executeSellOrder = async (input: SellOrderInput): Promise<Transaction> => {
  try {
    // Validate wallet belongs to user
    const wallet = await db.select()
      .from(walletsTable)
      .where(and(
        eq(walletsTable.id, input.wallet_id),
        eq(walletsTable.user_id, input.user_id)
      ))
      .execute();

    if (wallet.length === 0) {
      throw new Error('Wallet not found or does not belong to user');
    }

    // Get current asset price
    const asset = await db.select()
      .from(cryptoAssetsTable)
      .where(eq(cryptoAssetsTable.symbol, input.asset_symbol))
      .execute();

    if (asset.length === 0) {
      throw new Error('Asset not found');
    }

    // Get user's portfolio for the asset
    const portfolio = await db.select()
      .from(portfolioTable)
      .where(and(
        eq(portfolioTable.user_id, input.user_id),
        eq(portfolioTable.asset_symbol, input.asset_symbol)
      ))
      .execute();

    if (portfolio.length === 0) {
      throw new Error('No portfolio entry found for this asset');
    }

    // Validate user has sufficient balance
    const currentAmount = parseFloat(portfolio[0].amount);
    if (currentAmount < input.amount) {
      throw new Error('Insufficient crypto balance');
    }

    // Determine price per unit
    const currentPrice = parseFloat(asset[0].current_price);
    const pricePerUnit = input.order_type === 'MARKET' 
      ? currentPrice
      : input.limit_price || 0;

    if (pricePerUnit <= 0) {
      throw new Error('Invalid price per unit');
    }

    // Calculate values
    const totalValue = input.amount * pricePerUnit;
    const fee = totalValue * 0.001; // 0.1% trading fee
    const netProceeds = totalValue - fee;

    // Generate transaction hash
    const transactionHash = '0x' + Math.random().toString(16).substr(2, 64);

    // Create transaction record
    const transactionResult = await db.insert(transactionsTable)
      .values({
        user_id: input.user_id,
        wallet_id: input.wallet_id,
        transaction_type: 'SELL',
        asset_symbol: input.asset_symbol,
        amount: input.amount.toString(),
        price_per_unit: pricePerUnit.toString(),
        total_value: totalValue.toString(),
        fee: fee.toString(),
        status: 'COMPLETED',
        transaction_hash: transactionHash,
        completed_at: new Date()
      })
      .returning()
      .execute();

    const transaction = transactionResult[0];

    // Update portfolio - reduce amount
    const newAmount = currentAmount - input.amount;
    const currentValue = newAmount * currentPrice;
    const avgBuyPrice = parseFloat(portfolio[0].average_buy_price);
    const profitLoss = currentValue - (newAmount * avgBuyPrice);
    const profitLossPercentage = newAmount > 0 ? (profitLoss / (newAmount * avgBuyPrice)) * 100 : 0;

    if (newAmount > 0) {
      // Update existing portfolio entry
      await db.update(portfolioTable)
        .set({
          amount: newAmount.toString(),
          current_value: currentValue.toString(),
          profit_loss: profitLoss.toString(),
          profit_loss_percentage: profitLossPercentage.toString(),
          last_updated: new Date()
        })
        .where(and(
          eq(portfolioTable.user_id, input.user_id),
          eq(portfolioTable.asset_symbol, input.asset_symbol)
        ))
        .execute();
    } else {
      // Remove portfolio entry if amount is zero
      await db.delete(portfolioTable)
        .where(and(
          eq(portfolioTable.user_id, input.user_id),
          eq(portfolioTable.asset_symbol, input.asset_symbol)
        ))
        .execute();
    }

    // Update wallet balance (add proceeds)
    const currentBalance = parseFloat(wallet[0].balance);
    const newBalance = currentBalance + netProceeds;

    await db.update(walletsTable)
      .set({
        balance: newBalance.toString(),
        updated_at: new Date()
      })
      .where(eq(walletsTable.id, input.wallet_id))
      .execute();

    // Convert numeric fields back to numbers before returning
    return {
      ...transaction,
      amount: parseFloat(transaction.amount),
      price_per_unit: parseFloat(transaction.price_per_unit),
      total_value: parseFloat(transaction.total_value),
      fee: parseFloat(transaction.fee)
    };
  } catch (error) {
    console.error('Sell order execution failed:', error);
    throw error;
  }
};