import type { CategoryKey } from '../types';

const STUDIO_CATEGORY_IMAGES: Record<Exclude<CategoryKey, 'all'>, string> = {
  beauty: '/src/assets/images/category_beauty_studio_1795481655281.jpg',
  home: '/src/assets/images/category_home_studio_1795481655278.jpg',
  gadget: '/src/assets/images/category_gadget_studio_1795481655424.jpg',
  fashion: '/src/assets/images/category_lifestyle_studio_1795481655098.jpg',
  wellness: '/src/assets/images/category_lifestyle_studio_1795481655098.jpg',
  pet: '/src/assets/images/category_home_studio_1795481655278.jpg',
};

export function getStudioFallbackImage(category: Exclude<CategoryKey, 'all'>): string {
  return STUDIO_CATEGORY_IMAGES[category] ?? STUDIO_CATEGORY_IMAGES.home;
}
