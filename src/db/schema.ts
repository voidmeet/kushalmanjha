import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

// Brands table
export const brands = sqliteTable('brands', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Products table with strict constraints
export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  brandId: integer('brand_id').references(() => brands.id).notNull(),
  category: text('category'), // "general" | "premium" | null
  name: text('name').notNull(),
  cord: integer('cord').notNull(), // 6 | 9 | 12
  reelSize: integer('reel_size').notNull(), // 1000 | 2500 | 5000
  metersPerReel: integer('meters_per_reel').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Inventory items table
export const inventoryItems = sqliteTable('inventory_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').references(() => products.id).notNull(),
  boxes: integer('boxes').default(0),
  reels: integer('reels').default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Orders table with auto-generated order_id
export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderId: text('order_id').notNull().unique(),
  customer: text('customer').notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  reels: integer('reels').notNull(),
  status: text('status').notNull().default('pending'), // "pending" | "processing" | "ready" | "completed"
  dueDate: text('due_date'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Bags table for tracking picking/bagging
export const bags = sqliteTable('bags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderId: integer('order_id').references(() => orders.id).notNull(),
  pickedReels: integer('picked_reels').default(0),
  createdAt: text('created_at').notNull(),
});

// Analytics events table for tracking metrics
export const analyticsEvents = sqliteTable('analytics_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventType: text('event_type').notNull(), // "order_created", "inventory_updated", "reels_picked"
  entityType: text('entity_type').notNull(), // "order", "inventory", "bag"
  entityId: integer('entity_id').notNull(),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: text('created_at').notNull(),
});