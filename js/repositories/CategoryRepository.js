import { Category } from '../models/Category.js';
import { categoriesData } from '../data/categories.data.js';

export class CategoryRepository {
    async getAll() { return categoriesData.map((d) => new Category(d)); }
}
