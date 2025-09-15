import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { brands } from '@/db/schema';

export async function GET(request: NextRequest) {
  try {
    const allBrands = await db.select({
      id: brands.id,
      name: brands.name,
      createdAt: brands.createdAt,
      updatedAt: brands.updatedAt
    }).from(brands);

    return NextResponse.json(allBrands, { status: 200 });
  } catch (error) {
    console.error('GET brands error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      code: 'DATABASE_ERROR'
    }, { status: 500 });
  }
}