import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, products, brands, bags } from '@/db/schema';
import { eq, and, inArray, desc, asc, sql, sum, count, like } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const customer = searchParams.get('customer');

    // Build status filter
    let statusFilter = inArray(orders.status, ['processing', 'ready']);
    if (status && ['processing', 'ready'].includes(status)) {
      statusFilter = eq(orders.status, status);
    }

    // Build customer filter
    let customerFilter = undefined;
    if (customer) {
      customerFilter = like(orders.customer, `%${customer}%`);
    }

    const query = db.select({
      orderDbId: orders.id,
      orderId: orders.orderId,
      customer: orders.customer,
      productName: products.name,
      brandName: brands.name,
      category: products.category,
      cord: products.cord,
      reelSize: products.reelSize,
      totalReels: orders.reels,
      pickedReels: sum(bags.pickedReels),
      status: orders.status,
      dueDate: orders.dueDate,
      createdAt: orders.createdAt
    })
    .from(orders)
    .innerJoin(products, eq(orders.productId, products.id))
    .innerJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(bags, eq(orders.id, bags.orderId))
    .where(and(statusFilter, customerFilter))
    .groupBy(
      orders.id,
      orders.orderId,
      orders.customer,
      products.name,
      brands.name,
      products.category,
      products.cord,
      products.reelSize,
      orders.reels,
      orders.status,
      orders.dueDate,
      orders.createdAt
    )
    .orderBy(desc(orders.createdAt));

    const results = await query;

    // Calculate remaining reels and format response
    const formattedResults = results.map(row => ({
      orderId: row.orderId,
      orderDbId: row.orderDbId,
      customer: row.customer,
      productName: row.productName,
      brandName: row.brandName,
      category: row.category,
      cord: row.cord,
      reelSize: row.reelSize,
      totalReels: row.totalReels,
      pickedReels: Number(row.pickedReels) || 0,
      remainingReels: row.totalReels - (Number(row.pickedReels) || 0),
      status: row.status,
      dueDate: row.dueDate,
      createdAt: row.createdAt
    }));

    return NextResponse.json(formattedResults);
  } catch (error) {
    console.error('GET bags error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, pickedReels } = body;

    // Validate required fields
    if (!orderId) {
      return NextResponse.json({ 
        error: 'orderId is required',
        code: 'MISSING_ORDER_ID'
      }, { status: 400 });
    }

    if (pickedReels === undefined || pickedReels === null) {
      return NextResponse.json({ 
        error: 'pickedReels is required',
        code: 'MISSING_PICKED_REELS'
      }, { status: 400 });
    }

    // Validate pickedReels is positive integer
    if (!Number.isInteger(pickedReels) || pickedReels <= 0) {
      return NextResponse.json({ 
        error: 'pickedReels must be a positive integer',
        code: 'INVALID_PICKED_REELS'
      }, { status: 400 });
    }

    // Start transaction
    const result = await db.transaction(async (tx) => {
      // Check if order exists
      const order = await tx.select({
        id: orders.id,
        reels: orders.reels,
        status: orders.status
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

      if (order.length === 0) {
        throw new Error('ORDER_NOT_FOUND');
      }

      // Check order status
      if (!['processing', 'ready'].includes(order[0].status)) {
        throw new Error('INVALID_ORDER_STATUS');
      }

      // Calculate current picked reels
      const currentBags = await tx.select({
        totalPicked: sum(bags.pickedReels)
      })
      .from(bags)
      .where(eq(bags.orderId, orderId));

      const totalPicked = Number(currentBags[0].totalPicked) || 0;
      const remainingReels = order[0].reels - totalPicked;

      // Validate sufficient reels available
      if (pickedReels > remainingReels) {
        throw new Error('INSUFFICIENT_REELS');
      }

      // Insert new bag record
      const newBag = await tx.insert(bags)
        .values({
          orderId: orderId,
          pickedReels: pickedReels,
          createdAt: new Date().toISOString()
        })
        .returning();

      // Get updated order summary
      const updatedBags = await tx.select({
        totalPicked: sum(bags.pickedReels)
      })
      .from(bags)
      .where(eq(bags.orderId, orderId));

      const updatedOrder = await tx.select({
        orderId: orders.orderId,
        customer: orders.customer,
        productName: products.name,
        brandName: brands.name,
        category: products.category,
        cord: products.cord,
        reelSize: products.reelSize,
        totalReels: orders.reels,
        status: orders.status,
        dueDate: orders.dueDate,
        createdAt: orders.createdAt
      })
      .from(orders)
      .innerJoin(products, eq(orders.productId, products.id))
      .innerJoin(brands, eq(products.brandId, brands.id))
      .where(eq(orders.id, orderId))
      .limit(1);

      const finalTotalPicked = Number(updatedBags[0].totalPicked) || 0;

      return {
        bag: newBag[0],
        orderSummary: {
          orderId: updatedOrder[0].orderId,
          customer: updatedOrder[0].customer,
          productName: updatedOrder[0].productName,
          brandName: updatedOrder[0].brandName,
          category: updatedOrder[0].category,
          cord: updatedOrder[0].cord,
          reelSize: updatedOrder[0].reelSize,
          totalReels: updatedOrder[0].totalReels,
          pickedReels: finalTotalPicked,
          remainingReels: updatedOrder[0].totalReels - finalTotalPicked,
          status: updatedOrder[0].status,
          dueDate: updatedOrder[0].dueDate,
          createdAt: updatedOrder[0].createdAt
        }
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('POST bags error:', error);
    
    if (error instanceof Error) {
      if (error.message === 'ORDER_NOT_FOUND') {
        return NextResponse.json({ 
          error: 'Order not found',
          code: 'ORDER_NOT_FOUND'
        }, { status: 404 });
      }
      if (error.message === 'INVALID_ORDER_STATUS') {
        return NextResponse.json({ 
          error: 'Order is not available for picking',
          code: 'INVALID_ORDER_STATUS'
        }, { status: 400 });
      }
      if (error.message === 'INSUFFICIENT_REELS') {
        return NextResponse.json({ 
          error: 'Cannot pick more reels than remaining',
          code: 'INSUFFICIENT_REELS'
        }, { status: 409 });
      }
    }
    
    return NextResponse.json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}