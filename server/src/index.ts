import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  registerInputSchema,
  loginInputSchema,
  ktpExtractionInputSchema,
  simExtractionInputSchema,
  createWalletInputSchema,
  updateUserProfileInputSchema,
  buyOrderInputSchema,
  sellOrderInputSchema
} from './schema';

// Import handlers
import { registerUser } from './handlers/register_user';
import { loginUser } from './handlers/login_user';
import { extractKtpData } from './handlers/extract_ktp_data';
import { extractSimData } from './handlers/extract_sim_data';
import { getUserProfile } from './handlers/get_user_profile';
import { updateUserProfile } from './handlers/update_user_profile';
import { createWallet } from './handlers/create_wallet';
import { getUserWallets } from './handlers/get_user_wallets';
import { getCryptoAssets } from './handlers/get_crypto_assets';
import { getUserPortfolio } from './handlers/get_user_portfolio';
import { executeBuyOrder } from './handlers/execute_buy_order';
import { executeSellOrder } from './handlers/execute_sell_order';
import { getUserTransactions } from './handlers/get_user_transactions';
import { getTradingDashboard } from './handlers/get_trading_dashboard';
import { getKtpData } from './handlers/get_ktp_data';
import { getSimData } from './handlers/get_sim_data';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  register: publicProcedure
    .input(registerInputSchema)
    .mutation(({ input }) => registerUser(input)),

  login: publicProcedure
    .input(loginInputSchema)
    .mutation(({ input }) => loginUser(input)),

  // User profile routes
  getUserProfile: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getUserProfile(input.userId)),

  updateUserProfile: publicProcedure
    .input(updateUserProfileInputSchema)
    .mutation(({ input }) => updateUserProfile(input)),

  // KTP and SIM extraction routes
  extractKtpData: publicProcedure
    .input(ktpExtractionInputSchema)
    .mutation(({ input }) => extractKtpData(input)),

  extractSimData: publicProcedure
    .input(simExtractionInputSchema)
    .mutation(({ input }) => extractSimData(input)),

  getKtpData: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getKtpData(input.userId)),

  getSimData: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getSimData(input.userId)),

  // Wallet management routes
  createWallet: publicProcedure
    .input(createWalletInputSchema)
    .mutation(({ input }) => createWallet(input)),

  getUserWallets: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getUserWallets(input.userId)),

  // Cryptocurrency and market data routes
  getCryptoAssets: publicProcedure
    .query(() => getCryptoAssets()),

  getUserPortfolio: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getUserPortfolio(input.userId)),

  // Trading routes
  executeBuyOrder: publicProcedure
    .input(buyOrderInputSchema)
    .mutation(({ input }) => executeBuyOrder(input)),

  executeSellOrder: publicProcedure
    .input(sellOrderInputSchema)
    .mutation(({ input }) => executeSellOrder(input)),

  getUserTransactions: publicProcedure
    .input(z.object({ 
      userId: z.number(),
      limit: z.number().optional()
    }))
    .query(({ input }) => getUserTransactions(input.userId, input.limit)),

  // Dashboard routes
  getTradingDashboard: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getTradingDashboard(input.userId)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();