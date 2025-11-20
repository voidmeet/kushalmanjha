import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { products, brands } from '@/db/schema';
import { eq, and, like } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const brand = searchParams.get('brand');
    const category = searchParams.get('category');
    const cord = searchParams.get('cord');
    const reel_size = searchParams.get('reel_size');

    // Validate cord parameter
    if (cord) {
      const cordValue = parseInt(cord);
      if (![6, 9, 12].includes(cordValue)) {
        return NextResponse.json(
          { error: 'Invalid cord value. Must be 6, 9, or 12', code: 'INVALID_CORD' },
          { status: 400 }
        );
      }
    }

    // Validate reel_size parameter
    if (reel_size) {
      const reelSizeValue = parseInt(reel_size);
      if (![1000, 2500, 5000].includes(reelSizeValue)) {
        return NextResponse.json(
          { error: 'Invalid reel_size value. Must be 1000, 2500, or 5000', code: 'INVALID_REEL_SIZE' },
          { status: 400 }
        );
      }
    }

    // Build query with joins
    let query = db
      .select({
        id: products.id,
        brandId: products.brandId,
        brandName: brands.name,
        category: products.category,
        name: products.name,
        cord: products.cord,
        reelSize: products.reelSize,
        metersPerReel: products.metersPerReel,
        isActive: products.isActive,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .innerJoin(brands, eq(products.brandId, brands.id))
      .where(eq(products.isActive, true));

    // Build conditions array
    const conditions = [eq(products.isActive, true)];

    if (brand) {
      conditions.push(like(brands.name, `%${brand}%`));
    }

    if (category) {
      conditions.push(eq(products.category, category));
    }

    if (cord) {
      conditions.push(eq(products.cord, parseInt(cord)));
    }

    if (reel_size) {
      conditions.push(eq(products.reelSize, parseInt(reel_size)));
    }

    // Apply all conditions
    if (conditions.length > 1) {
      query = query.where(and(...conditions));
    }

    const results = await query;

    return NextResponse.json(results);
  } catch (error) {
    console.error('Products GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}