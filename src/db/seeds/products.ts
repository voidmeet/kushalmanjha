import { db } from '@/db';
import { products } from '@/db/schema';

async function main() {
    const sampleProducts = [
        {
            brandId: 1,
            category: 'general',
            name: 'Super Sankal',
            cord: 9,
            reelSize: 1000,
            metersPerReel: 1000,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            brandId: 1,
            category: 'general',
            name: 'Super Sankal',
            cord: 9,
            reelSize: 2500,
            metersPerReel: 2500,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            brandId: 1,
            category: 'premium',
            name: '24 Caret',
            cord: 9,
            reelSize: 2500,
            metersPerReel: 2500,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            brandId: 1,
            category: 'premium',
            name: '24 Caret',
            cord: 12,
            reelSize: 2500,
            metersPerReel: 2500,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            brandId: 1,
            category: null,
            name: 'Eco Dor',
            cord: 9,
            reelSize: 2500,
            metersPerReel: 2500,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }
    ];

    await db.insert(products).values(sampleProducts);
    
    console.log('✅ Products seeder completed successfully');
}

main().catch((error) => {
    console.error('❌ Seeder failed:', error);
});