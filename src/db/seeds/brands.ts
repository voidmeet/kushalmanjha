import { db } from '@/db';
import { brands } from '@/db/schema';

async function main() {
    const sampleBrands = [
        {
            name: 'Chain',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            name: 'Panda',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            name: 'Genda',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            name: 'AK56',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            name: 'Others',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }
    ];

    await db.insert(brands).values(sampleBrands);
    
    console.log('✅ Brands seeder completed successfully');
}

main().catch((error) => {
    console.error('❌ Seeder failed:', error);
});