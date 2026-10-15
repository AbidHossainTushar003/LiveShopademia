import 'dotenv/config';
import { Pool } from 'pg';
import { DEMO_PRODUCTS, DEMO_SHOPS, getDemoCatalogCounts } from './demoCatalog.js';
import { validateDemoCatalogSeedTarget } from './demoCatalogSeedGuard.js';

async function seedDemoCatalog() {
    validateDemoCatalogSeedTarget({ args: process.argv.slice(2), env: process.env });
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 1,
        connectionTimeoutMillis: 5000,
        statement_timeout: 15000
    });
    const client = await pool.connect();
    try {
        const schema = await client.query(`
            SELECT to_regclass('public.shops') AS shops,
                   to_regclass('public.shop_product_categories') AS categories,
                   to_regclass('public.managed_products') AS products
        `);
        if (!schema.rows[0]?.shops || !schema.rows[0]?.categories || !schema.rows[0]?.products) {
            throw new Error('Initialize the local development database before seeding demo content.');
        }

        await client.query('BEGIN');
        const shopIds = new Map();
        for (const shop of DEMO_SHOPS) {
            const inserted = await client.query(
                `INSERT INTO shops
                     (id, slug, name, description, location, contact_email,
                      contact_phone, contact_whatsapp, advance_charge, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
                 ON CONFLICT (slug) DO NOTHING
                 RETURNING id, name, status`,
                [shop.id, shop.slug, shop.name, shop.description, shop.location,
                    shop.contactEmail, shop.contactPhone, shop.contactWhatsapp, shop.advanceCharge]
            );
            const existing = inserted.rows[0] ?? (await client.query(
                'SELECT id, name, status FROM shops WHERE slug = $1',
                [shop.slug]
            )).rows[0];
            if (!existing || existing.name !== shop.name || existing.status !== 'active') {
                throw new Error(`The demo shop slug ${shop.slug} already belongs to a different or inactive shop.`);
            }
            shopIds.set(shop.id, existing.id);
            await client.query(
                `INSERT INTO shop_product_categories (shop_id, id, name, icon, is_default)
                 VALUES ($1, 'gadgets', 'Electronics', 'fa-laptop', TRUE),
                        ($1, 'accessories', 'Jewelry & Accessories', 'fa-gem', TRUE),
                        ($1, 'clothing', 'Clothing', 'fa-shirt', TRUE),
                        ($1, 'more', 'Other', 'fa-box', TRUE)
                 ON CONFLICT (shop_id, id) DO NOTHING`,
                [existing.id]
            );
        }

        const products = DEMO_PRODUCTS.map((product) => ({
            id: product.id,
            name: product.name,
            description: product.description,
            image_alt: product.imageAlt,
            seo_title: product.seoTitle,
            meta_description: product.metaDescription,
            price: product.price,
            old_price: product.oldPrice,
            category: product.category,
            image: product.image,
            images: product.images,
            stock_quantity: product.stockQuantity,
            is_available: product.isAvailable,
            shop_id: shopIds.get(product.shopId)
        }));
        await client.query(
            `INSERT INTO managed_products
                 (id, name, description, image_alt, seo_title, meta_description,
                  price, old_price, category, image, images, stock_quantity, is_available, shop_id)
             SELECT id, name, description, image_alt, seo_title, meta_description,
                    price, old_price, category, image, images, stock_quantity, is_available, shop_id
             FROM jsonb_to_recordset($1::jsonb) AS product(
                 id text, name text, description text, image_alt text, seo_title text,
                 meta_description text, price bigint, old_price bigint, category text,
                 image text, images text[], stock_quantity bigint, is_available boolean, shop_id uuid
             )
             ON CONFLICT (id) DO NOTHING`,
            [JSON.stringify(products)]
        );
        await client.query('COMMIT');

        const { shops, products: productCount, minProductsPerShop, maxProductsPerShop } = getDemoCatalogCounts();
        console.info(`Demo catalog ready: ${shops} clearly labeled demo shops; ${productCount} complete products (${minProductsPerShop}-${maxProductsPerShop} per shop).`);
        console.info('Listings use public Unsplash image links. Demo shops do not have administrator accounts.');
    } catch (error) {
        await client.query('ROLLBACK').catch((rollbackError) => {
            console.error('Could not roll back demo catalog seed:', rollbackError.message);
        });
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

seedDemoCatalog().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
