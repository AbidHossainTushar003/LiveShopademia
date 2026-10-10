import { fetchWithTimeout } from '../utils/fetchWithTimeout.js';

export class ApiCategoryRepository {
    constructor(baseUrl, shopSlug = null) {
        this.baseUrl = baseUrl;
        this.shopPath = shopSlug ? `/shops/${encodeURIComponent(shopSlug)}` : '';
    }
    async getAll() {
        const response = await fetchWithTimeout(`${this.baseUrl}${this.shopPath}/categories`);
        if (!response.ok) throw new Error(`API ${response.status} on /categories`);
        const result = await response.json();
        if (!Array.isArray(result.data)) throw new Error('The catalog API returned invalid categories.');
        return result.data;
    }
}
