import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, products, brands, inventoryItems, analyticsEvents } from '@/db/schema';
import { eq, and, desc, asc, like, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const customer = searchParams.get('customer');
    const productId = searchParams.get('productId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const sort = searchParams.get('sort') || 'createdAt';
    const order = searchParams.get('order') || 'desc';

    // Build base query with joins
    let query = db.select({
      id: orders.id,
      orderId: orders.orderId,
      customer: orders.customer,
      productId: orders.productId,
      productName: products.name,
      brandName: brands.name,
      category: products.category,
      cord: products.cord,
      reelSize: products.reelSize,
      reels: orders.reels,
      status: orders.status,
      dueDate: orders.dueDate,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt
    })
    .from(orders)
    .innerJoin(products, eq(orders.productId, products.id))
    .innerJoin(brands, eq(products.brandId, brands.id));

    // Apply filters
    const conditions = [];
    
    if (status) {
      conditions.push(eq(orders.status, status));
    }
    
    if (customer) {
      conditions.push(like(orders.customer, `%${customer}%`));
    }
    
    if (productId && !isNaN(parseInt(productId))) {
      conditions.push(eq(orders.productId, parseInt(productId)));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Apply sorting
    const orderBy = order === 'asc' ? asc : desc;
    if (sort === 'orderId') {
      query = query.orderBy(orderBy(orders.orderId));
    } else if (sort === 'customer') {
      query = query.orderBy(orderBy(orders.customer));
    } else if (sort === 'status') {
      query = query.orderBy(orderBy(orders.status));
    } else {
      query = query.orderBy(orderBy(orders.createdAt));
    }

    const results = await query.limit(limit).offset(offset);

    return NextResponse.json(results);
  } catch (error) {
    console.error('GET orders error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customer, productId, reels, dueDate } = body;

    // Validate required fields
    if (!customer || typeof customer !== 'string' || customer.trim().length === 0) {
      return NextResponse.json({ 
        error: 'Customer is required and must be a non-empty string',
        code: 'INVALID_CUSTOMER'
      }, { status: 400 });
    }

    if (!productId || isNaN(parseInt(productId))) {
      return NextResponse.json({ 
        error: 'Product ID is required and must be a valid number',
        code: 'INVALID_PRODUCT_ID'
      }, { status: 400 });
    }

    if (!reels || isNaN(parseInt(reels)) || parseInt(reels) <= 0) {
      return NextResponse.json({ 
        error: 'Reels must be a positive integer',
        code: 'INVALID_REELS'
      }, { status: 400 });
    }

    const productIdNum = parseInt(productId);
    const reelsNum = parseInt(reels);

    // Validate dueDate format if provided
    if (dueDate) {
      const dueDateObj = new Date(dueDate);
      if (isNaN(dueDateObj.getTime())) {
        return NextResponse.json({ 
          error: 'Due date must be a valid ISO date string',
          code: 'INVALID_DUE_DATE'
        }, { status: 400 });
      }
    }

    // Start transaction
    return await db.transaction(async (tx) => {
      // Check if product exists and get inventory
      const productWithInventory = await tx.select({
        product: products,
        inventory: inventoryItems,
        brand: brands
      })
      .from(products)
      .innerJoin(brands, eq(products.brandId, brands.id))
      .leftJoin(inventoryItems, eq(products.id, inventoryItems.productId))
      .where(eq(products.id, productIdNum))
      .limit(1);

      if (productWithInventory.length === 0) {
        return NextResponse.json({ 
          error: 'Product not found',
          code: 'PRODUCT_NOT_FOUND'
        }, { status: 404 });
      }

      const { product, inventory, brand } = productWithInventory[0];
      const availableReels = inventory?.reels || 0;

      // Check inventory
      if (availableReels < reelsNum) {
        return NextResponse.json({ 
          error: `Insufficient inventory. Available: ${availableReels}, Requested: ${reelsNum}`,
          code: 'INSUFFICIENT_INVENTORY'
        }, { status: 409 });
      }

      // Generate next order ID
      const maxOrderIdResult = await tx.select({
        maxOrderId: sql`MAX(CAST(SUBSTRING(${orders.orderId}, 5) AS INTEGER))`
      }).from(orders);

      const maxNum = maxOrderIdResult[0]?.maxOrderId || 0;
      const nextOrderNum = parseInt(maxNum.toString()) + 1;
      const orderId = `ORD-${nextOrderNum.toString().padStart(6, '0')}`;

      // Create order
      const newOrder = await tx.insert(orders)
        .values({
          orderId,
          customer: customer.trim(),
          productId: productIdNum,
          reels: reelsNum,
          status: 'pending',
          dueDate: dueDate || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .returning();

      // Update inventory (decrement reels)
      if (inventory) {
        await tx.update(inventoryItems)
          .set({
            reels: availableReels - reelsNum,
            updatedAt: new Date().toISOString()
          })
          .where(eq(inventoryItems.productId, productIdNum));
      }

      // Record analytics event
      await tx.insert(analyticsEvents)
        .values({
          eventType: 'order_created',
          entityType: 'order',
          entityId: newOrder[0].id,
          metadata: JSON.stringify({
            customer: customer.trim(),
            productId: productIdNum,
            reels: reelsNum,
            inventoryBefore: availableReels,
            inventoryAfter: availableReels - reelsNum
          }),
          createdAt: new Date().toISOString()
        });

      // Return order with product details
      const result = {
        id: newOrder[0].id,
        orderId: newOrder[0].orderId,
        customer: newOrder[0].customer,
        productId: newOrder[0].productId,
        productName: product.name,
        brandName: brand.name,
        category: product.category,
        cord: product.cord,
        reelSize: product.reelSize,
        reels: newOrder[0].reels,
        status: newOrder[0].status,
        dueDate: newOrder[0].dueDate,
        createdAt: newOrder[0].createdAt,
        updatedAt: newOrder[0].updatedAt
      };

      return NextResponse.json(result, { status: 201 });
    });
  } catch (error) {
    console.error('POST orders error:', error);
    
    if (error instanceof Error && error.message.includes('constraint')) {
      return NextResponse.json({ 
        error: 'Constraint violation: ' + error.message,
        code: 'CONSTRAINT_VIOLATION'
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');

  if (!id || isNaN(parseInt(id))) {
    return NextResponse.json({ 
      error: 'Valid ID is required',
      code: 'INVALID_ID'
    }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { status, customer, reels, dueDate } = body;

    // Start transaction
    return await db.transaction(async (tx) => {
      // Get existing order
      const existingOrder = await tx.select()
        .from(orders)
        .where(eq(orders.id, parseInt(id)))
        .limit(1);

      if (existingOrder.length === 0) {
        return NextResponse.json({ 
          error: 'Order not found',
          code: 'ORDER_NOT_FOUND'
        }, { status: 404 });
      }

      const order = existingOrder[0];
      const updates: any = {};

      // Validate and prepare updates
      if (status !== undefined) {
        const validStatuses = ['pending', 'processing', 'ready', 'completed'];
        if (!validStatuses.includes(status)) {
          return NextResponse.json({ 
            error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
            code: 'INVALID_STATUS'
          }, { status: 400 });
        }
        updates.status = status;
      }

      if (customer !== undefined) {
        if (typeof customer !== 'string' || customer.trim().length === 0) {
          return NextResponse.json({ 
            error: 'Customer must be a non-empty string',
            code: 'INVALID_CUSTOMER'
          }, { status: 400 });
        }
        updates.customer = customer.trim();
      }

      if (reels !== undefined) {
        if (isNaN(parseInt(reels)) || parseInt(reels) <= 0) {
          return NextResponse.json({ 
            error: 'Reels must be a positive integer',
            code: 'INVALID_REELS'
          }, { status: 400 });
        }
        
        const newReelsNum = parseInt(reels);
        const reelsDiff = newReelsNum - order.reels;

        if (reelsDiff !== 0) {
          // Get current inventory
          const inventory = await tx.select()
            .from(inventoryItems)
            .where(eq(inventoryItems.productId, order.productId))
            .limit(1);

          const currentInventory = inventory[0]?.reels || 0;
          const newInventory = currentInventory - reelsDiff;

          if (newInventory < 0) {
            return NextResponse.json({ 
              error: `Insufficient inventory for reel change. Available: ${currentInventory}, Required change: ${reelsDiff}`,
              code: 'INSUFFICIENT_INVENTORY'
            }, { status: 409 });
          }

          // Update inventory
          if (inventory[0]) {
            await tx.update(inventoryItems)
              .set({
                reels: newInventory,
                updatedAt: new Date().toISOString()
              })
              .where(eq(inventoryItems.productId, order.productId));
          }

          updates.reels = newReelsNum;
        }
      }

      if (dueDate !== undefined) {
        if (dueDate !== null) {
          const dueDateObj = new Date(dueDate);
          if (isNaN(dueDateObj.getTime())) {
            return NextResponse.json({ 
              error: 'Due date must be a valid ISO date string or null',
              code: 'INVALID_DUE_DATE'
            }, { status: 400 });
          }
        }
        updates.dueDate = dueDate;
      }

      // Update timestamp
      updates.updatedAt = new Date().toISOString();

      // Perform update
      const updatedOrder = await tx.update(orders)
        .set(updates)
        .where(eq(orders.id, parseInt(id)))
        .returning();

      // Get full order details
      const result = await tx.select({
        id: orders.id,
        orderId: orders.orderId,
        customer: orders.customer,
        productId: orders.productId,
        productName: products.name,
        brandName: brands.name,
        category: products.category,
        cord: products.cord,
        reelSize: products.reelSize,
        reels: orders.reels,
        status: orders.status,
        dueDate: orders.dueDate,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt
      })
      .from(orders)
      .innerJoin(products, eq(orders.productId, products.id))
      .innerJoin(brands, eq(products.brandId, brands.id))
      .where(eq(orders.id, parseInt(id)))
      .limit(1);

      return NextResponse.json(result[0]);
    });
  } catch (error) {
    console.error('PUT orders error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');

  if (!id || isNaN(parseInt(id))) {
    return NextResponse.json({ 
      error: 'Valid ID is required',
      code: 'INVALID_ID'
    }, { status: 400 });
  }

  try {
    // Start transaction
    return await db.transaction(async (tx) => {
      // Get order details
      const order = await tx.select()
        .from(orders)
        .where(eq(orders.id, parseInt(id)))
        .limit(1);

      if (order.length === 0) {
        return NextResponse.json({ 
          error: 'Order not found',
          code: 'ORDER_NOT_FOUND'
        }, { status: 404 });
      }

      const orderData = order[0];

      // Delete order
      const deletedOrder = await tx.delete(orders)
        .where(eq(orders.id, parseInt(id)))
        .returning();

      // Restore inventory (add reels back)
      const inventory = await tx.select()
        .from(inventoryItems)
        .where(eq(inventoryItems.productId, orderData.productId))
        .limit(1);

      if (inventory[0]) {
        await tx.update(inventoryItems)
          .set({
            reels: inventory[0].reels + orderData.reels,
            updatedAt: new Date().toISOString()
          })
          .where(eq(inventoryItems.productId, orderData.productId));
      }

      return NextResponse.json({ 
        success: true,
        message: 'Order deleted successfully',
        data: deletedOrder[0]
      });
    });
  } catch (error) {
    console.error('DELETE orders error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}