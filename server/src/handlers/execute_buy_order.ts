import { db } from '../db';
import { transactionsTable, walletsTable, cryptoAssetsTable, portfolioTable } from '../db/schema';
import { type BuyOrderInput, type Transaction } from '../schema';
import { eq, and } from 'drizzle-orm';

export const executeBuyOrder = async (input: BuyOrderInput): Promise<Transaction> => {
  try {
    // 1. Validate that the wallet exists and belongs to the user
    const wallets = await db.select()
      .from(walletsTable)
      .where(and(
        eq(walletsTable.id, input.wallet_id),
        eq(walletsTable.user_id, input.user_id)
      ))
      .execute();

    if (wallets.length === 0) {
      throw new Error('Wallet not found or does not belong to user');
    }

    const wallet = wallets[0];
    const currentBalance = parseFloat(wallet.balance);

    // 2. Get current asset price
    let pricePerUnit: number;
    
    if (input.order_type === 'MARKET') {
      // Fetch current market price from crypto_assets table
      const assets = await db.select()
        .from(cryptoAssetsTable)
        .where(eq(cryptoAssetsTable.symbol, input.asset_symbol))
        .execute();
      
      if (assets.length === 0) {
        throw new Error(`Asset ${input.asset_symbol} not found`);
      }
      
      pricePerUnit = parseFloat(assets[0].current_price);
    } else {
      // Use limit price for limit orders
      if (!input.limit_price) {
        throw new Error('Limit price is required for limit orders');
      }
      pricePerUnit = input.limit_price;
    }

    // 3. Calculate total cost including fees
    const subtotal = input.amount * pricePerUnit;
    const fee = subtotal * 0.001; // 0.1% trading fee
    const totalCost = subtotal + fee;

    // 4. Check if wallet has sufficient balance
    if (currentBalance < totalCost) {
      throw new Error(`Insufficient balance. Required: ${totalCost.toFixed(8)}, Available: ${currentBalance.toFixed(8)}`);
    }

    // 5. Create transaction record
    const transactionResult = await db.insert(transactionsTable)
      .values({
        user_id: input.user_id,
        wallet_id: input.wallet_id,
        transaction_type: 'BUY',
        asset_symbol: input.asset_symbol,
        amount: input.amount.toString(),
        price_per_unit: pricePerUnit.toString(),
        total_value: totalCost.toString(),
        fee: fee.toString(),
        status: 'COMPLETED',
        transaction_hash: '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join(''), // Mock 64-char transaction hash
        completed_at: new Date()
      })
      .returning()
      .execute();

    const transaction = transactionResult[0];

    // 6. Update wallet balance
    const newBalance = currentBalance - totalCost;
    await db.update(walletsTable)
      .set({ 
        balance: newBalance.toString(),
        updated_at: new Date()
      })
      .where(eq(walletsTable.id, input.wallet_id))
      .execute();

    // 7. Update or create portfolio entry
    const existingPortfolio = await db.select()
      .from(portfolioTable)
      .where(and(
        eq(portfolioTable.user_id, input.user_id),
        eq(portfolioTable.asset_symbol, input.asset_symbol)
      ))
      .execute();

    if (existingPortfolio.length > 0) {
      // Update existing portfolio entry
      const portfolio = existingPortfolio[0];
      const currentAmount = parseFloat(portfolio.amount);
      const currentAverageBuyPrice = parseFloat(portfolio.average_buy_price);
      
      // Calculate new average buy price
      const totalCurrentValue = currentAmount * currentAverageBuyPrice;
      const newTotalAmount = currentAmount + input.amount;
      const newAverageBuyPrice = (totalCurrentValue + subtotal) / newTotalAmount;
      const newCurrentValue = newTotalAmount * pricePerUnit;
      const newProfitLoss = newCurrentValue - (newTotalAmount * newAverageBuyPrice);
      const newProfitLossPercentage = newAverageBuyPrice > 0 ? (newProfitLoss / (newTotalAmount * newAverageBuyPrice)) * 100 : 0;

      await db.update(portfolioTable)
        .set({
          amount: newTotalAmount.toString(),
          average_buy_price: newAverageBuyPrice.toString(),
          current_value: newCurrentValue.toString(),
          profit_loss: newProfitLoss.toString(),
          profit_loss_percentage: newProfitLossPercentage.toString(),
          last_updated: new Date()
        })
        .where(eq(portfolioTable.id, portfolio.id))
        .execute();
    } else {
      // Create new portfolio entry
      const currentValue = input.amount * pricePerUnit;
      const profitLoss = currentValue - subtotal;
      const profitLossPercentage = subtotal > 0 ? (profitLoss / subtotal) * 100 : 0;

      await db.insert(portfolioTable)
        .values({
          user_id: input.user_id,
          asset_symbol: input.asset_symbol,
          amount: input.amount.toString(),
          average_buy_price: pricePerUnit.toString(),
          current_value: currentValue.toString(),
          profit_loss: profitLoss.toString(),
          profit_loss_percentage: profitLossPercentage.toString()
        })
        .execute();
    }

    // Return transaction with proper numeric conversions
    return {
      ...transaction,
      amount: parseFloat(transaction.amount),
      price_per_unit: parseFloat(transaction.price_per_unit),
      total_value: parseFloat(transaction.total_value),
      fee: parseFloat(transaction.fee)
    };

  } catch (error) {
    console.error('Buy order execution failed:', error);
    throw error;
  }
};