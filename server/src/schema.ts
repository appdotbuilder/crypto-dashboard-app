import { z } from 'zod';

// User authentication schemas
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  full_name: z.string(),
  phone: z.string().nullable(),
  is_verified: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

export const registerInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(2),
  phone: z.string().optional()
});

export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

// KTP (Indonesian ID Card) data schema
export const ktpDataSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  nik: z.string(), // National ID Number
  full_name: z.string(),
  place_of_birth: z.string(),
  date_of_birth: z.coerce.date(),
  gender: z.enum(['M', 'F']),
  address: z.string(),
  rt_rw: z.string(),
  village: z.string(),
  district: z.string(),
  regency: z.string(),
  province: z.string(),
  religion: z.string(),
  marital_status: z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']),
  occupation: z.string(),
  nationality: z.string(),
  valid_until: z.string(), // Usually "SEUMUR HIDUP" (lifetime)
  created_at: z.coerce.date()
});

export type KtpData = z.infer<typeof ktpDataSchema>;

export const ktpExtractionInputSchema = z.object({
  user_id: z.number(),
  image_data: z.string() // Base64 encoded image or file path
});

export type KtpExtractionInput = z.infer<typeof ktpExtractionInputSchema>;

// SIM (Driver's License) data schema
export const simDataSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  license_number: z.string(),
  full_name: z.string(),
  place_of_birth: z.string(),
  date_of_birth: z.coerce.date(),
  address: z.string(),
  license_type: z.string(), // A, B, C, etc.
  issued_date: z.coerce.date(),
  valid_until: z.coerce.date(),
  issuing_office: z.string(),
  created_at: z.coerce.date()
});

export type SimData = z.infer<typeof simDataSchema>;

export const simExtractionInputSchema = z.object({
  user_id: z.number(),
  image_data: z.string() // Base64 encoded image or file path
});

export type SimExtractionInput = z.infer<typeof simExtractionInputSchema>;

// Wallet schema
export const walletSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  wallet_address: z.string(),
  wallet_type: z.enum(['BITCOIN', 'ETHEREUM', 'BINANCE_SMART_CHAIN', 'POLYGON']),
  balance: z.number(),
  private_key_encrypted: z.string().nullable(),
  is_primary: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Wallet = z.infer<typeof walletSchema>;

export const createWalletInputSchema = z.object({
  user_id: z.number(),
  wallet_type: z.enum(['BITCOIN', 'ETHEREUM', 'BINANCE_SMART_CHAIN', 'POLYGON']),
  is_primary: z.boolean().optional()
});

export type CreateWalletInput = z.infer<typeof createWalletInputSchema>;

// Cryptocurrency schema
export const cryptoAssetSchema = z.object({
  id: z.number(),
  symbol: z.string(),
  name: z.string(),
  current_price: z.number(),
  price_change_24h: z.number(),
  price_change_percentage_24h: z.number(),
  market_cap: z.number(),
  volume_24h: z.number(),
  last_updated: z.coerce.date()
});

export type CryptoAsset = z.infer<typeof cryptoAssetSchema>;

// User portfolio schema
export const portfolioSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  asset_symbol: z.string(),
  amount: z.number(),
  average_buy_price: z.number(),
  current_value: z.number(),
  profit_loss: z.number(),
  profit_loss_percentage: z.number(),
  last_updated: z.coerce.date()
});

export type Portfolio = z.infer<typeof portfolioSchema>;

// Trading transaction schema
export const transactionSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  wallet_id: z.number(),
  transaction_type: z.enum(['BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT']),
  asset_symbol: z.string(),
  amount: z.number(),
  price_per_unit: z.number(),
  total_value: z.number(),
  fee: z.number(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  transaction_hash: z.string().nullable(),
  created_at: z.coerce.date(),
  completed_at: z.coerce.date().nullable()
});

export type Transaction = z.infer<typeof transactionSchema>;

export const buyOrderInputSchema = z.object({
  user_id: z.number(),
  wallet_id: z.number(),
  asset_symbol: z.string(),
  amount: z.number(),
  order_type: z.enum(['MARKET', 'LIMIT']),
  limit_price: z.number().optional()
});

export type BuyOrderInput = z.infer<typeof buyOrderInputSchema>;

export const sellOrderInputSchema = z.object({
  user_id: z.number(),
  wallet_id: z.number(),
  asset_symbol: z.string(),
  amount: z.number(),
  order_type: z.enum(['MARKET', 'LIMIT']),
  limit_price: z.number().optional()
});

export type SellOrderInput = z.infer<typeof sellOrderInputSchema>;

// Trading dashboard data schema
export const tradingDashboardSchema = z.object({
  user_id: z.number(),
  total_portfolio_value: z.number(),
  total_profit_loss: z.number(),
  total_profit_loss_percentage: z.number(),
  top_performing_asset: z.string().nullable(),
  worst_performing_asset: z.string().nullable(),
  recent_transactions: z.array(transactionSchema),
  portfolio_breakdown: z.array(portfolioSchema),
  watchlist: z.array(cryptoAssetSchema)
});

export type TradingDashboard = z.infer<typeof tradingDashboardSchema>;

// User profile update schema
export const updateUserProfileInputSchema = z.object({
  user_id: z.number(),
  full_name: z.string().optional(),
  phone: z.string().nullable().optional(),
  current_password: z.string().optional(),
  new_password: z.string().min(8).optional()
});

export type UpdateUserProfileInput = z.infer<typeof updateUserProfileInputSchema>;

// Authentication response schema
export const authResponseSchema = z.object({
  user: userSchema,
  token: z.string(),
  expires_at: z.coerce.date()
});

export type AuthResponse = z.infer<typeof authResponseSchema>;