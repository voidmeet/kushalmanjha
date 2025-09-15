import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { inventoryItems, products, brands } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Valid ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { boxes, reels } = body;

    const updates: any = {};
    const validationErrors: string[] = [];

    if (boxes !== undefined) {
      if (!Number.isInteger(boxes) || boxes < 0) {
        validationErrors.push('Boxes must be a non-negative integer');
      } else {
        updates.boxes = boxes;
      }
    }

    if (reels !== undefined) {
      if (!Number.isInteger(reels) || reels < 0) {
        validationErrors.push('Reels must be a non-negative integer');
      } else {
        updates.reels = reels;
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: validationErrors.join(', '), code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update', code: 'MISSING_UPDATES' },
        { status: 400 }
      );
    }

    updates.updatedAt = new Date().toISOString();

    const [updatedItem] = await db
      .update(inventoryItems)
      .set(updates)
      .where(eq(inventoryItems.id, id))
      .returning();

    if (!updatedItem) {
      return NextResponse.json(
        { error: 'Inventory item not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const itemWithProduct = await db
      .select({
        id: inventoryItems.id,
        productId: inventoryItems.productId,
        boxes: inventoryItems.boxes,
        reels: inventoryItems.reels,
        createdAt: inventoryItems.createdAt,
        updatedAt: inventoryItems.updatedAt,
        product: {
          id: products.id,
          name: products.name,
          brandId: products.brandId,
          category: products.category,
          cord: products.cord,
          reelSize: products.reelSize,
          metersPerReel: products.metersPerReel,
          isActive: products.isActive
        },
        brand: {
          id: brands.id,
          name: brands.name
        }
      })
      .from(inventoryItems)
      .innerJoin(products, eq(inventoryItems.productId, products.id))
      .innerJoin(brands, eq(products.brandId, brands.id))
      .where(eq(inventoryItems.id, id))
      .limit(1);

    return NextResponse.json(itemWithProduct[0]);
  } catch (error) {
    console.error('PATCH /api/inventory/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Valid ID is required', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const deletedItem = await db
      .delete(inventoryItems)
      .where(eq(inventoryItems.id, id))
      .returning();

    if (deletedItem.length === 0) {
      return NextResponse.json(
        { error: 'Inventory item not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Inventory item deleted successfully',
      item: deletedItem[0]
    });
  } catch (error) {
    console.error('DELETE /api/inventory/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}