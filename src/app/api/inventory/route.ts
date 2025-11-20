import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { inventoryItems, products, brands } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const productId = searchParams.get('productId');

    let query = db
      .select({
        id: inventoryItems.id,
        productId: inventoryItems.productId,
        productName: products.name,
        brandName: brands.name,
        category: products.category,
        cord: products.cord,
        reelSize: products.reelSize,
        boxes: inventoryItems.boxes,
        reels: inventoryItems.reels,
        createdAt: inventoryItems.createdAt,
        updatedAt: inventoryItems.updatedAt,
      })
      .from(inventoryItems)
      .innerJoin(products, eq(inventoryItems.productId, products.id))
      .innerJoin(brands, eq(products.brandId, brands.id));

    if (productId) {
      const productIdNum = parseInt(productId);
      if (isNaN(productIdNum)) {
        return NextResponse.json({
          error: "Valid productId is required",
          code: "INVALID_PRODUCT_ID"
        }, { status: 400 });
      }
      query = query.where(eq(inventoryItems.productId, productIdNum));
    }

    const results = await query;

    if (productId && results.length === 0) {
      return NextResponse.json({ error: 'Inventory item not found for product' }, { status: 404 });
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('GET inventory error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, boxes, reels } = body;

    // Validate required fields
    if (productId === undefined || productId === null) {
      return NextResponse.json({
        error: "productId is required",
        code: "MISSING_PRODUCT_ID"
      }, { status: 400 });
    }

    if (boxes === undefined || boxes === null) {
      return NextResponse.json({
        error: "boxes is required",
        code: "MISSING_BOXES"
      }, { status: 400 });
    }

    if (reels === undefined || reels === null) {
      return NextResponse.json({
        error: "reels is required",
        code: "MISSING_REELS"
      }, { status: 400 });
    }

    // Validate data types
    const productIdNum = parseInt(productId);
    if (isNaN(productIdNum)) {
      return NextResponse.json({
        error: "Valid productId is required",
        code: "INVALID_PRODUCT_ID"
      }, { status: 400 });
    }

    const boxesNum = parseInt(boxes);
    if (isNaN(boxesNum) || boxesNum < 0) {
      return NextResponse.json({
        error: "boxes must be a non-negative integer",
        code: "INVALID_BOXES"
      }, { status: 400 });
    }

    const reelsNum = parseInt(reels);
    if (isNaN(reelsNum) || reelsNum < 0) {
      return NextResponse.json({
        error: "reels must be a non-negative integer",
        code: "INVALID_REELS"
      }, { status: 400 });
    }

    // Check if product exists
    const product = await db
      .select()
      .from(products)
      .where(eq(products.id, productIdNum))
      .limit(1);

    if (product.length === 0) {
      return NextResponse.json({
        error: "Product not found",
        code: "PRODUCT_NOT_FOUND"
      }, { status: 404 });
    }

    // Check if inventory item already exists for this product
    const existingItem = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.productId, productIdNum))
      .limit(1);

    let result;
    const now = new Date().toISOString();

    if (existingItem.length > 0) {
      // Update existing inventory item
      result = await db
        .update(inventoryItems)
        .set({
          boxes: boxesNum,
          reels: reelsNum,
          updatedAt: now
        })
        .where(eq(inventoryItems.productId, productIdNum))
        .returning();
    } else {
      // Create new inventory item
      result = await db
        .insert(inventoryItems)
        .values({
          productId: productIdNum,
          boxes: boxesNum,
          reels: reelsNum,
          createdAt: now,
          updatedAt: now
        })
        .returning();
    }

    // Get the complete inventory item with product and brand details
    const inventoryWithDetails = await db
      .select({
        id: inventoryItems.id,
        productId: inventoryItems.productId,
        productName: products.name,
        brandName: brands.name,
        category: products.category,
        cord: products.cord,
        reelSize: products.reelSize,
        boxes: inventoryItems.boxes,
        reels: inventoryItems.reels,
        createdAt: inventoryItems.createdAt,
        updatedAt: inventoryItems.updatedAt,
      })
      .from(inventoryItems)
      .innerJoin(products, eq(inventoryItems.productId, products.id))
      .innerJoin(brands, eq(products.brandId, brands.id))
      .where(eq(inventoryItems.id, result[0].id))
      .limit(1);

    return NextResponse.json(inventoryWithDetails[0], { status: existingItem.length > 0 ? 200 : 201 });
  } catch (error) {
    console.error('POST inventory error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({
        error: "Valid ID is required",
        code: "INVALID_ID"
      }, { status: 400 });
    }

    const body = await request.json();
    const { boxes, reels } = body;

    // Validate at least one field to update
    if (boxes === undefined && reels === undefined) {
      return NextResponse.json({
        error: "At least one field (boxes or reels) is required",
        code: "MISSING_UPDATE_FIELDS"
      }, { status: 400 });
    }

    const updates: any = {};
    const now = new Date().toISOString();

    if (boxes !== undefined) {
      const boxesNum = parseInt(boxes);
      if (isNaN(boxesNum) || boxesNum < 0) {
        return NextResponse.json({
          error: "boxes must be a non-negative integer",
          code: "INVALID_BOXES"
        }, { status: 400 });
      }
      updates.boxes = boxesNum;
    }

    if (reels !== undefined) {
      const reelsNum = parseInt(reels);
      if (isNaN(reelsNum) || reelsNum < 0) {
        return NextResponse.json({
          error: "reels must be a non-negative integer",
          code: "INVALID_REELS"
        }, { status: 400 });
      }
      updates.reels = reelsNum;
    }

    updates.updatedAt = now;

    // Update the inventory item
    const updated = await db
      .update(inventoryItems)
      .set(updates)
      .where(eq(inventoryItems.id, parseInt(id)))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });
    }

    // Get the complete updated inventory item with product and brand details
    const inventoryWithDetails = await db
      .select({
        id: inventoryItems.id,
        productId: inventoryItems.productId,
        productName: products.name,
        brandName: brands.name,
        category: products.category,
        cord: products.cord,
        reelSize: products.reelSize,
        boxes: inventoryItems.boxes,
        reels: inventoryItems.reels,
        createdAt: inventoryItems.createdAt,
        updatedAt: inventoryItems.updatedAt,
      })
      .from(inventoryItems)
      .innerJoin(products, eq(inventoryItems.productId, products.id))
      .innerJoin(brands, eq(products.brandId, brands.id))
      .where(eq(inventoryItems.id, parseInt(id)))
      .limit(1);

    return NextResponse.json(inventoryWithDetails[0]);
  } catch (error) {
    console.error('PUT inventory error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({
        error: "Valid ID is required",
        code: "INVALID_ID"
      }, { status: 400 });
    }

    const deleted = await db
      .delete(inventoryItems)
      .where(eq(inventoryItems.id, parseInt(id)))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Inventory item deleted successfully',
      deleted: deleted[0]
    });
  } catch (error) {
    console.error('DELETE inventory error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}