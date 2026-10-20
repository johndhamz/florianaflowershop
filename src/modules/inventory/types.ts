export const STOCK_LEVELS = ["in_stock", "low_stock", "out_of_stock"] as const;
export type StockLevel = (typeof STOCK_LEVELS)[number];
