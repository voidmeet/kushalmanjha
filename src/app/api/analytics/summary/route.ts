import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { brands, products, inventoryItems, orders, bags } from '@/db/schema';
import { eq, desc, asc, sql, and, gte, like } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    
    // Get total inventory reels by brand
    const inventoryReelsByBrand = await db
      .select({
        brandName: brands.name,
        totalReels: sql<number>`coalesce(sum(${inventoryItems.reels}), 0)`
      })
      .from(inventoryItems)
      .innerJoin(products, eq(inventoryItems.productId, products.id))
      .innerJoin(brands, eq(products.brandId, brands.id))
      .groupBy(brands.name)
      .orderBy(desc(sql<number>`coalesce(sum(${inventoryItems.reels}), 0)`));
    
    // Get today's orders count
    const todayOrdersResult = await db
      .select({
        count: sql<number>`count(*)`
      })
      .from(orders)
      .where(gte(orders.createdAt, todayISO));
    
    const todayOrdersCount = todayOrdersResult[0]?.count || 0;
    
    // Get orders by status
    const ordersByStatus = await db
      .select({
        status: orders.status,
        count: sql<number>`count(*)`
      })
      .from(orders)
      .groupBy(orders.status)
      .orderBy(desc(sql<number>`count(*)`));
    
    // Get reels picked today
    const reelsPickedTodayResult = await db
      .select({
        totalReels: sql<number>`coalesce(sum(${bags.pickedReels}), 0)`
      })
      .from(bags)
      .where(gte(bags.createdAt, todayISO));
    
    const reelsPickedToday = reelsPickedTodayResult[0]?.totalReels || 0;
    
    // Get top products by orders
    const topProductsByOrders = await db
      .select({
        productName: products.name,
        brandName: brands.name,
        orderCount: sql<number>`count(*)`
      })
      .from(orders)
      .innerJoin(products, eq(orders.productId, products.id))
      .innerJoin(brands, eq(products.brandId, brands.id))
      .groupBy(products.name, brands.name)
      .orderBy(desc(sql<number>`count(*)`))
      .limit(5);
    
    const analytics = {
      totalInventoryReelsByBrand: inventoryReelsByBrand.map(item => ({
        brandName: item.brandName,
        totalReels: Number(item.totalReels)
      })),
      todayOrdersCount: Number(todayOrdersCount),
      ordersByStatus: ordersByStatus.map(item => ({
        status: item.status,
        count: Number(item.count)
      })),
      reelsPickedToday: Number(reelsPickedToday),
      topProductsByOrders: topProductsByOrders.map(item => ({
        productName: item.productName,
        brandName: item.brandName,
        orderCount: Number(item.orderCount)
      }))
    };
    
    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Analytics summary error:', error);
    return NextResponse.json({ 
      error: 'Internal server error while generating analytics summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}