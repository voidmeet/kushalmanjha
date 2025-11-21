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
    let { productId, boxes, reels, brandName, productName, cord, reelSize } = body;

    // Validate common required fields
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

    let productIdNum: number;

    if (productId !== undefined && productId !== null && productId !== "") {
      productIdNum = parseInt(productId);
      if (isNaN(productIdNum)) {
        return NextResponse.json({
          error: "Valid productId is required",
          code: "INVALID_PRODUCT_ID"
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
    } else {
      // Try to create product if details are provided
      if (!brandName || !productName || !cord || !reelSize) {
        return NextResponse.json({
          error: "When productId is not provided; brandName, productName, cord, and reelSize are required",
          code: "MISSING_PRODUCT_DETAILS"
        }, { status: 400 });
      }

      const cordNum = parseInt(cord);
      const reelSizeNum = parseInt(reelSize);

      if (![6, 9, 12].includes(cordNum)) {
        return NextResponse.json({ error: "Invalid cord. Must be 6, 9, or 12" }, { status: 400 });
      }
      if (![1000, 2500, 5000].includes(reelSizeNum)) {
        return NextResponse.json({ error: "Invalid reelSize. Must be 1000, 2500, or 5000" }, { status: 400 });
      }

      // 1. Find or create Brand
      let brand = await db.select().from(brands).where(eq(brands.name, brandName)).limit(1);
      let brandId: number;
      const now = new Date().toISOString();

      if (brand.length === 0) {
        const newBrand = await db.insert(brands).values({
          name: brandName,
          createdAt: now,
          updatedAt: now
        }).returning();
        brandId = newBrand[0].id;
      } else {
        brandId = brand[0].id;
      }

      // 2. Find or create Product
      // Check if product exists with same brand, name, cord, reelSize
      const existingProduct = await db.select().from(products).where(
        and(
          eq(products.brandId, brandId),
          eq(products.name, productName),
          eq(products.cord, cordNum),
          eq(products.reelSize, reelSizeNum)
        )
      ).limit(1);

      if (existingProduct.length > 0) {
        productIdNum = existingProduct[0].id;
      } else {
        const newProduct = await db.insert(products).values({
          brandId,
          name: productName,
          cord: cordNum,
          reelSize: reelSizeNum,
          metersPerReel: reelSizeNum, // Assuming metersPerReel is same as reelSize for now
          category: "general", // Default category
          isActive: true,
          createdAt: now,
          updatedAt: now
        }).returning();
        productIdNum = newProduct[0].id;
      }
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
      // We add the new boxes/reels to the existing count? Or replace?
      // The previous logic seemed to replace (set). 
      // But usually "Add Inventory" implies adding to stock.
      // However, looking at the previous code:
      // .set({ boxes: boxesNum, reels: reelsNum ... })
      // It was replacing. The UI says "Add Inventory", but maybe it means "Set Inventory"?
      // Wait, the UI says "Record new stock arrivals".
      // If I have 5 boxes and I add 2, I expect 7.
      // But the previous code was doing `.set`.
      // Let's stick to the previous behavior for now to avoid breaking changes, 
      // OR assume the user inputs the TOTAL.
      // Actually, if it's "Add Inventory", it should probably increment.
      // But let's look at the previous code again.
      // It was: boxes: boxesNum, reels: reelsNum.
      // If the user enters 5, it sets it to 5.
      // I will keep it as is (replace) to be safe, or should I improve it?
      // The user said "Add Inventory".
      // Let's look at the UI: "Record new stock arrivals."
      // If I already have stock, and I get more, I'd expect to add.
      // But if the code was doing set, maybe I should stick to it to avoid confusion if they are used to it.
      // However, since I'm fixing a bug, I'll stick to the existing logic of SET for now, 
      // but wait, if I'm creating a new item, it's fine.
      // If I'm updating, the previous code was doing SET.
      // I will stick to SET to minimize risk, unless I see evidence otherwise.

      // Actually, let's look at the previous code:
      // result = await db.update(inventoryItems).set({ boxes: boxesNum, reels: reelsNum ... })
      // Yes, it was replacing.

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