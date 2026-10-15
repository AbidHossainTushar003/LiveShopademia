import { createHash } from 'node:crypto';

const demoShops = [
    { slug: 'demo-dhaka-gadget-gallery', name: 'Demo Dhaka Gadget Gallery', category: 'gadgets', group: 'electronics', location: 'Dhaka', types: ['Wireless headphones', 'Portable speaker', 'Smart watch', 'Phone charger'] },
    { slug: 'demo-smart-home-market', name: 'Demo Smart Home Market', category: 'more', group: 'home', location: 'Dhaka', types: ['Desk lamp', 'Storage basket', 'Table clock', 'Decorative vase'] },
    { slug: 'demo-urban-wear-studio', name: 'Demo Urban Wear Studio', category: 'clothing', group: 'fashion', location: 'Chattogram', types: ['Cotton t-shirt', 'Everyday shirt', 'Lightweight jacket', 'Casual trousers'] },
    { slug: 'demo-noor-jewelry-house', name: 'Demo Noor Jewelry House', category: 'accessories', group: 'jewelry', location: 'Dhaka', types: ['Pendant necklace', 'Hoop earrings', 'Charm bracelet', 'Stacking ring'] },
    { slug: 'demo-beauty-bloom-care', name: 'Demo Beauty Bloom Care', category: 'accessories', group: 'beauty', location: 'Sylhet', types: ['Face cleanser', 'Hydrating serum', 'Daily moisturizer', 'Mineral sunscreen'] },
    { slug: 'demo-active-path-sports', name: 'Demo Active Path Sports', category: 'clothing', group: 'travel', location: 'Khulna', types: ['Training t-shirt', 'Running shoes', 'Gym backpack', 'Sports bottle'] },
    { slug: 'demo-little-nest-kids', name: 'Demo Little Nest Kids', category: 'clothing', group: 'fashion', location: 'Dhaka', types: ['Kids cotton top', 'Soft cardigan', 'Everyday shorts', 'Printed sleepwear'] },
    { slug: 'demo-kitchen-comfort-co', name: 'Demo Kitchen Comfort Co.', category: 'more', group: 'kitchen', location: 'Rajshahi', types: ['Ceramic mug', 'Serving bowl', 'Kitchen towel set', 'Reusable lunch box'] },
    { slug: 'demo-travel-trail-gear', name: 'Demo Travel Trail Gear', category: 'more', group: 'travel', location: 'Chattogram', types: ['Travel backpack', 'Packing cube set', 'Weekend duffel', 'Compact travel pouch'] },
    { slug: 'demo-desk-study-shop', name: 'Demo Desk & Study Shop', category: 'more', group: 'electronics', location: 'Dhaka', types: ['Notebook set', 'Desk organizer', 'Reading light', 'Laptop stand'] },
    { slug: 'demo-petal-glow-beauty', name: 'Demo Petal & Glow Beauty', category: 'accessories', group: 'beauty', location: 'Barishal', types: ['Lip balm', 'Botanical face oil', 'Gentle toner', 'Body lotion'] },
    { slug: 'demo-craft-corner-dhaka', name: 'Demo Craft Corner Dhaka', category: 'more', group: 'home', location: 'Dhaka', types: ['Handwoven cushion cover', 'Wall art print', 'Woven storage tray', 'Handmade candle'] },
    { slug: 'demo-footstep-footwear', name: 'Demo Footstep Footwear', category: 'clothing', group: 'fashion', location: 'Mymensingh', types: ['Canvas sneaker', 'Everyday sandal', 'Leather-look loafer', 'Lightweight slip-on'] },
    { slug: 'demo-timepiece-gallery', name: 'Demo Timepiece Gallery', category: 'accessories', group: 'jewelry', location: 'Dhaka', types: ['Analog wristwatch', 'Minimal watch strap', 'Travel watch case', 'Classic desk clock'] },
    { slug: 'demo-phone-camera-house', name: 'Demo Phone & Camera House', category: 'gadgets', group: 'electronics', location: 'Chattogram', types: ['Phone case', 'Camera strap', 'Wireless earbuds', 'Portable tripod'] },
    { slug: 'demo-green-garden-living', name: 'Demo Green Garden Living', category: 'more', group: 'home', location: 'Rangpur', types: ['Indoor planter', 'Garden tool set', 'Watering can', 'Plant care kit'] },
    { slug: 'demo-modest-style-studio', name: 'Demo Modest Style Studio', category: 'clothing', group: 'fashion', location: 'Dhaka', types: ['Modest tunic', 'Everyday scarf', 'Longline cardigan', 'Relaxed-fit trousers'] },
    { slug: 'demo-gift-box-dhaka', name: 'Demo Gift Box Dhaka', category: 'more', group: 'kitchen', location: 'Dhaka', types: ['Gift mug set', 'Scented candle set', 'Keepsake journal', 'Gift-ready snack box'] }
];

const variants = ['Everyday', 'Classic', 'Compact', 'Studio', 'Travel', 'Soft-touch', 'Essential', 'Signature'];
const imagePools = {
    electronics: [
        'photo-1505740420928-5e560c06d30e',
        'photo-1523275335684-37898b6baf30',
        'photo-1526170375885-4d8ecf77b99f',
        'photo-1511707171634-5f897ff02aa9',
        'photo-1496181133206-80ce9b88a853',
        'photo-1608043152269-423dbba4e7e1',
        'photo-1606220945770-b5b6c2c55bf1',
        'photo-1598327105666-5b89351aff97'
    ],
    fashion: [
        'photo-1490481651871-ab68de25d43d',
        'photo-1529139574466-a303027c1d8b',
        'photo-1483985988355-763728e1935b',
        'photo-1524504388940-b1c1722653e1',
        'photo-1515886657613-9f3515b0d78f',
        'photo-1525507119028-ed4c629a60a3',
        'photo-1503342217505-b0a15ec3261c',
        'photo-1539109136881-3be0616acf4b'
    ],
    jewelry: [
        'photo-1535632066927-ab7c9ab60908',
        'photo-1515562141207-7a88fb7ce338',
        'photo-1611652022419-a9419f74343d',
        'photo-1617038220319-276d3cfab638',
        'photo-1605100804763-247f67b3557e',
        'photo-1611591437281-460bfbe1220a',
        'photo-1523170335258-f5ed11844a49',
        'photo-1522312346375-d1a52e2b99b3'
    ],
    beauty: [
        'photo-1556228578-0d85b1a4d571',
        'photo-1608571423902-eed4a5ad8108',
        'photo-1596462502278-27bfdc403348',
        'photo-1611930022073-b7a4ba5fcccd',
        'photo-1585386959984-a4155224a1ad',
        'photo-1608248543803-ba4f8c70ae0b',
        'photo-1598440947619-2c35fc9aa908',
        'photo-1571781926291-c477ebfd024b'
    ],
    home: [
        'photo-1503602642458-232111445657',
        'photo-1555041469-a586c61ea9bc',
        'photo-1600210492486-724fe5c67fb0',
        'photo-1494438639946-1ebd1d20bf85',
        'photo-1524758631624-e2822e304c36',
        'photo-1616486338812-3dadae4b4ace',
        'photo-1618221195710-dd6b41faaea6',
        'photo-1600607687939-ce8a6c25118c'
    ],
    travel: [
        'photo-1553062407-98eeb64c6a62',
        'photo-1473448912268-2022ce9509d8',
        'photo-1542291026-7eec264c27ff',
        'photo-1500530855697-b586d89ba3ee',
        'photo-1472396961693-142e6e269027',
        'photo-1519681393784-d120267933ba',
        'photo-1530789253388-582c481c54b0',
        'photo-1464822759023-fed622ff2c3b'
    ],
    kitchen: [
        'photo-1490645935967-10de6ba17061',
        'photo-1556909114-f6e7ad7d3136',
        'photo-1556911220-e15b29be8c8f',
        'photo-1579871494447-9811cf80d66c',
        'photo-1547592180-85f173990554',
        'photo-1498837167922-ddd27525d352',
        'photo-1512621776951-a57141f2eefd',
        'photo-1504674900247-0877df9cc836'
    ]
};

const basePrices = {
    gadgets: 850,
    accessories: 550,
    clothing: 700,
    more: 450
};

function stableUuid(value) {
    const hex = createHash('sha256').update(value).digest('hex').slice(0, 32).split('');
    hex[12] = '4';
    hex[16] = '8';
    const valueHex = hex.join('');
    return `${valueHex.slice(0, 8)}-${valueHex.slice(8, 12)}-${valueHex.slice(12, 16)}-${valueHex.slice(16, 20)}-${valueHex.slice(20)}`;
}

export const DEMO_SHOPS = demoShops.map((shop) => ({
    ...shop,
    id: stableUuid(`shop:${shop.slug}`),
    description: `${shop.name} is a fictional Shopademia demo storefront used to preview the marketplace catalog.`,
    contactEmail: `${shop.slug}@example.com`,
    contactPhone: '+8801700000000',
    contactWhatsapp: '+8801700000000',
    advanceCharge: 100
}));

export const DEMO_PRODUCTS = DEMO_SHOPS.flatMap((shop) =>
    shop.types.flatMap((type, typeIndex) =>
        variants.map((variant, variantIndex) => {
            const name = `${variant} ${type}`;
            const imageId = imagePools[shop.group][(variantIndex + typeIndex * 2) % imagePools[shop.group].length];
            const productId = `admin-${stableUuid(`product:${shop.slug}:${name}`)}`;
            const description = `${name} from ${shop.name}. This fictional demo listing includes clear product details and a real product-style photograph so the marketplace layout can be reviewed.`;
            const price = basePrices[shop.category] + typeIndex * 275 + variantIndex * 45;
            const oldPrice = variantIndex % 4 === 0 ? Math.ceil(price * 1.15) : null;
            return {
                id: productId,
                shopId: shop.id,
                name,
                description,
                imageAlt: `Product photograph of ${name.toLowerCase()}.`,
                seoTitle: `${name} | ${shop.name}`.slice(0, 70),
                metaDescription: `${name} from ${shop.name}. Browse this fictional demo product on Shopademia.`,
                price,
                oldPrice,
                category: shop.category,
                image: `https://images.unsplash.com/${imageId}?auto=format&fit=crop&w=900&q=80&seed=${encodeURIComponent(productId)}`,
                images: [`https://images.unsplash.com/${imageId}?auto=format&fit=crop&w=900&q=80&seed=${encodeURIComponent(productId)}`],
                stockQuantity: 8 + ((typeIndex * variants.length + variantIndex) % 18),
                isAvailable: true
            };
        })
    )
);

export function getDemoCatalogCounts() {
    return {
        shops: DEMO_SHOPS.length,
        products: DEMO_PRODUCTS.length,
        minProductsPerShop: Math.min(...DEMO_SHOPS.map(({ id }) => DEMO_PRODUCTS.filter((product) => product.shopId === id).length)),
        maxProductsPerShop: Math.max(...DEMO_SHOPS.map(({ id }) => DEMO_PRODUCTS.filter((product) => product.shopId === id).length))
    };
}
