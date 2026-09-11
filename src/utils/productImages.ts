// Curated high-resolution motorcycle oils & spare parts imagery matching tablet POS card display

export const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  'Oli Mesin': { bg: 'bg-[#0091EA]', text: 'text-white', border: 'border-[#0081cb]', icon: '🛢️' },
  'Oli Gardan & Transmisi': { bg: 'bg-[#43A047]', text: 'text-white', border: 'border-[#388e3c]', icon: '⚙️' },
  'Kampas & Rem': { bg: 'bg-[#0288D1]', text: 'text-white', border: 'border-[#0277bd]', icon: '🛑' },
  'Busi & Kelistrikan': { bg: 'bg-[#F57C00]', text: 'text-white', border: 'border-[#ef6c00]', icon: '⚡' },
  'CVT & Drivetrain': { bg: 'bg-[#7B1FA2]', text: 'text-white', border: 'border-[#6a1b9a]', icon: '🔄' },
  'Ban & Velg': { bg: 'bg-[#546E7A]', text: 'text-white', border: 'border-[#455a64]', icon: '🛞' },
  'Filter & Cairan': { bg: 'bg-[#00897B]', text: 'text-white', border: 'border-[#00796b]', icon: '🧪' },
  'Jasa Servis': { bg: 'bg-[#D81B60]', text: 'text-white', border: 'border-[#c2185b]', icon: '🔧' },
};

export const DEFAULT_PRODUCT_IMAGES: Record<string, string> = {
  // Oils
  'OLI-001': 'https://images.unsplash.com/photo-1635770310667-6e3e56f4d1a3?w=500&auto=format&fit=crop&q=80',
  'OLI-002': 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=500&auto=format&fit=crop&q=80',
  'OLI-003': 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=500&auto=format&fit=crop&q=80',
  'OLI-004': 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=500&auto=format&fit=crop&q=80',
  'OLI-005': 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=500&auto=format&fit=crop&q=80',
  'OLI-006': 'https://images.unsplash.com/photo-1589739900243-4b52cd9b104e?w=500&auto=format&fit=crop&q=80',

  // Gear Oil
  'GRD-001': 'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?w=500&auto=format&fit=crop&q=80',
  'GRD-002': 'https://images.unsplash.com/photo-1615906655593-ad0386982a0f?w=500&auto=format&fit=crop&q=80',
  'GRD-003': 'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?w=500&auto=format&fit=crop&q=80',

  // Brakes
  'REM-001': 'https://images.unsplash.com/photo-1558980664-3a031cf67ea8?w=500&auto=format&fit=crop&q=80',
  'REM-002': 'https://images.unsplash.com/photo-1449426468159-d96dbf08f19f?w=500&auto=format&fit=crop&q=80',
  'REM-003': 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=500&auto=format&fit=crop&q=80',
  'REM-004': 'https://images.unsplash.com/photo-1584905066893-7d5c142ba4e1?w=500&auto=format&fit=crop&q=80',

  // Spark Plugs & Electric
  'BSI-001': 'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?w=500&auto=format&fit=crop&q=80',
  'BSI-002': 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=500&auto=format&fit=crop&q=80',
  'BSI-003': 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=500&auto=format&fit=crop&q=80',

  // CVT
  'CVT-001': 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=500&auto=format&fit=crop&q=80',
  'CVT-002': 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=500&auto=format&fit=crop&q=80',
  'CVT-003': 'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?w=500&auto=format&fit=crop&q=80',

  // Filters & Coolant
  'FLT-001': 'https://images.unsplash.com/photo-1589739900243-4b52cd9b104e?w=500&auto=format&fit=crop&q=80',
  'FLT-002': 'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?w=500&auto=format&fit=crop&q=80',

  // Services
  'SRV-001': 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=500&auto=format&fit=crop&q=80',
  'SRV-002': 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=500&auto=format&fit=crop&q=80',
  'SRV-003': 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=500&auto=format&fit=crop&q=80',
  'SRV-004': 'https://images.unsplash.com/photo-1558980664-3a031cf67ea8?w=500&auto=format&fit=crop&q=80',
  'SRV-005': 'https://images.unsplash.com/photo-1584905066893-7d5c142ba4e1?w=500&auto=format&fit=crop&q=80',
  'SRV-006': 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=500&auto=format&fit=crop&q=80',
};

// Generic category photo fallback
export const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  'Oli Mesin': 'https://images.unsplash.com/photo-1635770310667-6e3e56f4d1a3?w=500&auto=format&fit=crop&q=80',
  'Oli Gardan & Transmisi': 'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?w=500&auto=format&fit=crop&q=80',
  'Kampas & Rem': 'https://images.unsplash.com/photo-1558980664-3a031cf67ea8?w=500&auto=format&fit=crop&q=80',
  'Busi & Kelistrikan': 'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?w=500&auto=format&fit=crop&q=80',
  'CVT & Drivetrain': 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=500&auto=format&fit=crop&q=80',
  'Ban & Velg': 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=500&auto=format&fit=crop&q=80',
  'Filter & Cairan': 'https://images.unsplash.com/photo-1589739900243-4b52cd9b104e?w=500&auto=format&fit=crop&q=80',
  'Jasa Servis': 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=500&auto=format&fit=crop&q=80',
};

export function getProductImage(sku?: string, categoryName?: string, customImage?: string | null): string {
  if (customImage && customImage.trim()) {
    return customImage.trim();
  }
  if (sku && DEFAULT_PRODUCT_IMAGES[sku]) {
    return DEFAULT_PRODUCT_IMAGES[sku];
  }
  if (categoryName && CATEGORY_FALLBACK_IMAGES[categoryName]) {
    return CATEGORY_FALLBACK_IMAGES[categoryName];
  }
  return 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=500&auto=format&fit=crop&q=80';
}
