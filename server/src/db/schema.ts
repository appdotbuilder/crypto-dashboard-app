import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  numeric, 
  integer, 
  boolean,
  date,
  pgEnum,
  unique
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enum definitions
export const genderEnum = pgEnum('gender', ['M', 'F']);
export const maritalStatusEnum = pgEnum('marital_status', ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']);
export const walletTypeEnum = pgEnum('wallet_type', ['BITCOIN', 'ETHEREUM', 'BINANCE_SMART_CHAIN', 'POLYGON']);
export const transactionTypeEnum = pgEnum('transaction_type', ['BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT']);
export const transactionStatusEnum = pgEnum('transaction_status', ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED']);
export const orderTypeEnum = pgEnum('order_type', ['MARKET', 'LIMIT']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  full_name: text('full_name').notNull(),
  phone: text('phone'), // Nullable by default
  is_verified: boolean('is_verified').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// KTP data table
export const ktpDataTable = pgTable('ktp_data', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').references(() => usersTable.id).notNull(),
  nik: text('nik').notNull(), // National ID Number
  full_name: text('full_name').notNull(),
  place_of_birth: text('place_of_birth').notNull(),
  date_of_birth: date('date_of_birth').notNull(),
  gender: genderEnum('gender').notNull(),
  address: text('address').notNull(),
  rt_rw: text('rt_rw').notNull(),
  village: text('village').notNull(),
  district: text('district').notNull(),
  regency: text('regency').notNull(),
  province: text('province').notNull(),
  religion: text('religion').notNull(),
  marital_status: maritalStatusEnum('marital_status').notNull(),
  occupation: text('occupation').notNull(),
  nationality: text('nationality').notNull(),
  valid_until: text('valid_until').notNull(), // Usually "SEUMUR HIDUP"
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueUserKtp: unique().on(table.user_id), // One KTP per user
}));

// SIM data table
export const simDataTable = pgTable('sim_data', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').references(() => usersTable.id).notNull(),
  license_number: text('license_number').notNull().unique(),
  full_name: text('full_name').notNull(),
  place_of_birth: text('place_of_birth').notNull(),
  date_of_birth: date('date_of_birth').notNull(),
  address: text('address').notNull(),
  license_type: text('license_type').notNull(), // A, B, C, etc.
  issued_date: date('issued_date').notNull(),
  valid_until: date('valid_until').notNull(),
  issuing_office: text('issuing_office').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Wallets table
export const walletsTable = pgTable('wallets', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').references(() => usersTable.id).notNull(),
  wallet_address: text('wallet_address').notNull().unique(),
  wallet_type: walletTypeEnum('wallet_type').notNull(),
  balance: numeric('balance', { precision: 18, scale: 8 }).notNull().default('0'),
  private_key_encrypted: text('private_key_encrypted'), // Nullable for security
  is_primary: boolean('is_primary').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Crypto assets table (for price tracking)
export const cryptoAssetsTable = pgTable('crypto_assets', {
  id: serial('id').primaryKey(),
  symbol: text('symbol').notNull().unique(),
  name: text('name').notNull(),
  current_price: numeric('current_price', { precision: 18, scale: 8 }).notNull(),
  price_change_24h: numeric('price_change_24h', { precision: 18, scale: 8 }).notNull(),
  price_change_percentage_24h: numeric('price_change_percentage_24h', { precision: 8, scale: 4 }).notNull(),
  market_cap: numeric('market_cap', { precision: 20, scale: 2 }).notNull(),
  volume_24h: numeric('volume_24h', { precision: 20, scale: 2 }).notNull(),
  last_updated: timestamp('last_updated').defaultNow().notNull(),
});

// User portfolio table
export const portfolioTable = pgTable('portfolio', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').references(() => usersTable.id).notNull(),
  asset_symbol: text('asset_symbol').references(() => cryptoAssetsTable.symbol).notNull(),
  amount: numeric('amount', { precision: 18, scale: 8 }).notNull(),
  average_buy_price: numeric('average_buy_price', { precision: 18, scale: 8 }).notNull(),
  current_value: numeric('current_value', { precision: 18, scale: 2 }).notNull(),
  profit_loss: numeric('profit_loss', { precision: 18, scale: 2 }).notNull(),
  profit_loss_percentage: numeric('profit_loss_percentage', { precision: 8, scale: 4 }).notNull(),
  last_updated: timestamp('last_updated').defaultNow().notNull(),
}, (table) => ({
  uniqueUserAsset: unique().on(table.user_id, table.asset_symbol), // One portfolio entry per asset per user
}));

// Transactions table
export const transactionsTable = pgTable('transactions', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').references(() => usersTable.id).notNull(),
  wallet_id: integer('wallet_id').references(() => walletsTable.id).notNull(),
  transaction_type: transactionTypeEnum('transaction_type').notNull(),
  asset_symbol: text('asset_symbol').references(() => cryptoAssetsTable.symbol).notNull(),
  amount: numeric('amount', { precision: 18, scale: 8 }).notNull(),
  price_per_unit: numeric('price_per_unit', { precision: 18, scale: 8 }).notNull(),
  total_value: numeric('total_value', { precision: 18, scale: 2 }).notNull(),
  fee: numeric('fee', { precision: 18, scale: 8 }).notNull().default('0'),
  status: transactionStatusEnum('status').notNull().default('PENDING'),
  transaction_hash: text('transaction_hash'), // Nullable until completed
  created_at: timestamp('created_at').defaultNow().notNull(),
  completed_at: timestamp('completed_at'), // Nullable until completed
});

// Relations
export const usersRelations = relations(usersTable, ({ one, many }) => ({
  ktpData: one(ktpDataTable),
  simData: many(simDataTable),
  wallets: many(walletsTable),
  portfolio: many(portfolioTable),
  transactions: many(transactionsTable),
}));

export const ktpDataRelations = relations(ktpDataTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [ktpDataTable.user_id],
    references: [usersTable.id],
  }),
}));

export const simDataRelations = relations(simDataTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [simDataTable.user_id],
    references: [usersTable.id],
  }),
}));

export const walletsRelations = relations(walletsTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [walletsTable.user_id],
    references: [usersTable.id],
  }),
  transactions: many(transactionsTable),
}));

export const portfolioRelations = relations(portfolioTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [portfolioTable.user_id],
    references: [usersTable.id],
  }),
  asset: one(cryptoAssetsTable, {
    fields: [portfolioTable.asset_symbol],
    references: [cryptoAssetsTable.symbol],
  }),
}));

export const transactionsRelations = relations(transactionsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [transactionsTable.user_id],
    references: [usersTable.id],
  }),
  wallet: one(walletsTable, {
    fields: [transactionsTable.wallet_id],
    references: [walletsTable.id],
  }),
  asset: one(cryptoAssetsTable, {
    fields: [transactionsTable.asset_symbol],
    references: [cryptoAssetsTable.symbol],
  }),
}));

export const cryptoAssetsRelations = relations(cryptoAssetsTable, ({ many }) => ({
  portfolioEntries: many(portfolioTable),
  transactions: many(transactionsTable),
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
export type KtpData = typeof ktpDataTable.$inferSelect;
export type NewKtpData = typeof ktpDataTable.$inferInsert;
export type SimData = typeof simDataTable.$inferSelect;
export type NewSimData = typeof simDataTable.$inferInsert;
export type Wallet = typeof walletsTable.$inferSelect;
export type NewWallet = typeof walletsTable.$inferInsert;
export type CryptoAsset = typeof cryptoAssetsTable.$inferSelect;
export type NewCryptoAsset = typeof cryptoAssetsTable.$inferInsert;
export type Portfolio = typeof portfolioTable.$inferSelect;
export type NewPortfolio = typeof portfolioTable.$inferInsert;
export type Transaction = typeof transactionsTable.$inferSelect;
export type NewTransaction = typeof transactionsTable.$inferInsert;

// Export all tables for proper query building
export const tables = {
  users: usersTable,
  ktpData: ktpDataTable,
  simData: simDataTable,
  wallets: walletsTable,
  cryptoAssets: cryptoAssetsTable,
  portfolio: portfolioTable,
  transactions: transactionsTable,
};