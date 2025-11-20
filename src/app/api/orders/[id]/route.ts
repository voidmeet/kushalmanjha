import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, products, brands, inventoryItems } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const orderId = parseInt(id);

    const orderResults = await db
      .select({
        id: orders.id,
        orderId: orders.orderId,
        customer: orders.customer,
        productId: orders.productId,
        reels: orders.reels,
        status: orders.status,
        dueDate: orders.dueDate,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        productName: products.name,
        brandName: brands.name,
        category: products.category,
        cord: products.cord,
        reelSize: products.reelSize,
        metersPerReel: products.metersPerReel
      })
      .from(orders)
      .innerJoin(products, eq(orders.productId, products.id))
      .innerJoin(brands, eq(products.brandId, brands.id))
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderResults.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const order = orderResults[0];

    return NextResponse.json({
      id: order.id,
      orderId: order.orderId,
      customer: order.customer,
      product: {
        id: order.productId,
        name: order.productName,
        brand: order.brandName,
        category: order.category,
        cord: order.cord,
        reelSize: order.reelSize,
        metersPerReel: order.metersPerReel
      },
      reels: order.reels,
      status: order.status,
      dueDate: order.dueDate,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    });

  } catch (error) {
    console.error('GET order error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const orderId = parseInt(id);
    const body = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ 
        error: "Request body is required",
        code: "MISSING_BODY" 
      }, { status: 400 });
    }

    const { status, reels, dueDate, customer } = body;
    const updates: any = {};

    if (status !== undefined) {
      const validStatuses = ['pending', 'processing', 'ready', 'completed'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ 
          error: "Status must be one of: pending, processing, ready, completed",
          code: "INVALID_STATUS" 
        }, { status: 400 });
      }
      updates.status = status;
    }

    if (reels !== undefined) {
      if (!Number.isInteger(reels) || reels <= 0) {
        return NextResponse.json({ 
          error: "Reels must be a positive integer",
          code: "INVALID_REELS" 
        }, { status: 400 });
      }
      updates.reels = reels;
    }

    if (dueDate !== undefined) {
      if (typeof dueDate !== 'string' || isNaN(Date.parse(dueDate))) {
        return NextResponse.json({ 
          error: "Due date must be a valid ISO date string",
          code: "INVALID_DATE" 
        }, { status: 400 });
      }
      updates.dueDate = dueDate;
    }

    if (customer !== undefined) {
      if (typeof customer !== 'string' || customer.trim().length === 0) {
        return NextResponse.json({ 
          error: "Customer must be a non-empty string",
          code: "INVALID_CUSTOMER" 
        }, { status: 400 });
      }
      updates.customer = customer.trim();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ 
        error: "No valid fields to update",
        code: "NO_FIELDS" 
      }, { status: 400 });
    }

    await db.transaction(async (tx) => {
      const existingOrder = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (existingOrder.length === 0) {
        throw new Error('Order not found');
      }

      const order = existingOrder[0];

      if (updates.reels && updates.reels !== order.reels) {
        const inventoryItem = await tx
          .select()
          .from(inventoryItems)
          .where(eq(inventoryItems.productId, order.productId))
          .limit(1);

        if (inventoryItem.length === 0) {
          throw new Error('Inventory item not found');
        }

        const inventory = inventoryItem[0];
        const reelDifference = updates.reels - order.reels;

        if (reelDifference > 0) {
          if (inventory.reels < reelDifference) {
            throw new Error('Insufficient inventory');
          }
          await tx
            .update(inventoryItems)
            .set({ 
              reels: sql`${inventoryItems.reels} - ${reelDifference}`,
              updatedAt: new Date().toISOString()
            })
            .where(eq(inventoryItems.id, inventory.id));
        } else {
          await tx
            .update(inventoryItems)
            .set({ 
              reels: sql`${inventoryItems.reels} + ${Math.abs(reelDifference)}`,
              updatedAt: new Date().toISOString()
            })
            .where(eq(inventoryItems.id, inventory.id));
        }
      }

      updates.updatedAt = new Date().toISOString();

      const updatedOrder = await tx
        .update(orders)
        .set(updates)
        .where(eq(orders.id, orderId))
        .returning();

      if (updatedOrder.length === 0) {
        throw new Error('Failed to update order');
      }
    });

    const result = await db
      .select({
        id: orders.id,
        orderId: orders.orderId,
        customer: orders.customer,
        productId: orders.productId,
        reels: orders.reels,
        status: orders.status,
        dueDate: orders.dueDate,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        productName: products.name,
        brandName: brands.name,
        category: products.category,
        cord: products.cord,
        reelSize: products.reelSize,
        metersPerReel: products.metersPerReel
      })
      .from(orders)
      .innerJoin(products, eq(orders.productId, products.id))
      .innerJoin(brands, eq(products.brandId, brands.id))
      .where(eq(orders.id, orderId))
      .limit(1);

    return NextResponse.json({
      id: result[0].id,
      orderId: result[0].orderId,
      customer: result[0].customer,
      product: {
        id: result[0].productId,
        name: result[0].productName,
        brand: result[0].brandName,
        category: result[0].category,
        cord: result[0].cord,
        reelSize: result[0].reelSize,
        metersPerReel: result[0].metersPerReel
      },
      reels: result[0].reels,
      status: result[0].status,
      dueDate: result[0].dueDate,
      createdAt: result[0].createdAt,
      updatedAt: result[0].updatedAt
    });

  } catch (error: any) {
    console.error('PATCH order error:', error);
    
    if (error.message === 'Order not found') {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    
    if (error.message === 'Insufficient inventory') {
      return NextResponse.json({ 
        error: 'Insufficient inventory',
        code: "INSUFFICIENT_INVENTORY" 
      }, { status: 409 });
    }
    
    if (error.message === 'Inventory item not found') {
      return NextResponse.json({ 
        error: 'Inventory item not found',
        code: "INVENTORY_NOT_FOUND"
      }, { status: 404 });
    }

    return NextResponse.json({ 
      error: 'Internal server error: ' + error.message 
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({
        error: "Valid ID is required",
        code: "INVALID_ID",
      }, { status: 400 });
    }
    const orderId = parseInt(id);

    await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (existing.length === 0) {
        throw new Error('ORDER_NOT_FOUND');
      }

      const order = existing[0];

      // restore reels back to inventory for this product
      const inv = await tx
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.productId, order.productId))
        .limit(1);

      if (inv.length > 0) {
        await tx
          .update(inventoryItems)
          .set({
            reels: sql`${inventoryItems.reels} + ${order.reels}`,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(inventoryItems.id, inv[0].id));
      }

      // delete order
      await tx.delete(orders).where(eq(orders.id, orderId));
    });

    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    if (error?.message === 'ORDER_NOT_FOUND') {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    console.error('DELETE order error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}