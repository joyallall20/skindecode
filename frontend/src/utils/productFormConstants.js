export const SKIN_TYPES = ['oily', 'dry', 'combination', 'normal', 'sensitive'];

export const CONCERNS = [
  'acne', 'pigmentation', 'dark-spots', 'dryness', 'excess-oil', 'aging',
  'fine-lines', 'uneven-texture', 'dullness', 'redness', 'dark-circles',
  'dehydration', 'large-pores', 'sun-damage',
];

export const TRI_STATE_OPTIONS = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
  { value: 'unknown', label: 'Unknown' },
];

export const CURRENCY_OPTIONS = [
  { value: 'INR', label: 'INR (₹)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
];

export const SUGGESTED_RETAILERS = ['Amazon', 'Nykaa', 'Myntra', 'Flipkart', 'Purplle', 'Tira', 'Brand website'];

export const parseTriState = (value) => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return null;
};

export const formatTriState = (value) => {
  if (value === true) return 'true';
  if (value === false) return 'false';
  return 'unknown';
};

export const parseFormIngredientList = (value) => {
  const raw = Array.isArray(value) ? value.join(',') : String(value || '');
  return [...new Set(
    raw
      .split(/[\n;,]+/)
      .map((entry) => entry.replace(/^[-*•]\s*/, '').replace(/^ingredients?:?\s*/i, '').trim())
      .filter((entry) => entry && !/^ingredients?:?$/i.test(entry))
  )];
};

export const resolveImageUrls = (images = []) =>
  (images || [])
    .map((entry) => (typeof entry === 'string' ? entry : entry?.url || entry?.secure_url || ''))
    .map((url) => String(url).trim())
    .filter(Boolean);

const nextKey = () => `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const toEditorImages = (images = []) => {
  const list = (images || [])
    .map((entry, index) => {
      if (typeof entry === 'string') {
        const url = entry.trim();
        if (!url) return null;
        return { key: nextKey(), url, publicId: '', isPrimary: index === 0, _id: null, file: null };
      }
      const url = String(entry?.url || entry?.secure_url || '').trim();
      if (!url) return null;
      return {
        key: String(entry._id || entry.publicId || nextKey()),
        url,
        publicId: entry.publicId || entry.public_id || '',
        isPrimary: Boolean(entry.isPrimary) || index === 0,
        _id: entry._id || null,
        file: entry.file || null,
      };
    })
    .filter(Boolean);

  if (list.length && !list.some((image) => image.isPrimary)) list[0].isPrimary = true;
  return list;
};

export const emptyPurchaseOption = () => ({
  localId: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  _id: null,
  retailer: '',
  productUrl: '',
  affiliateUrl: '',
  price: '',
  currency: 'INR',
  isActive: false,
});

export const offersToForm = (offers = []) =>
  (offers || []).map((offer) => ({
    localId: String(offer._id || `opt-${Math.random().toString(36).slice(2, 7)}`),
    _id: offer._id || null,
    retailer: offer.retailer?.name || offer.retailer || '',
    retailerId: offer.retailer?._id || offer.retailerId || '',
    productUrl: offer.originalUrl || offer.url || '',
    affiliateUrl: offer.affiliateUrl || '',
    price: offer.price ?? '',
    currency: offer.currency || 'INR',
    isActive: Boolean(offer.isActive),
  }));

export const emptyProductFormData = () => ({
  name: '',
  slug: '',
  brand: '',
  category: '',
  variant: '',
  size: '',
  quantity: '',
  claims: '',
  description: '',
  images: [],
  sourceUrl: '',
  ingredients: '',
  keyIngredients: '',
  ingredientSource: '',
  ingredientsTouched: false,
  skinTypes: [],
  concerns: [],
  fragranceFree: 'unknown',
  alcoholFree: 'unknown',
  essentialOilFree: 'unknown',
  pregnancyFriendly: 'unknown',
  purchaseOptions: [],
  isActive: false,
});

const purchaseOptionFromExtraction = (extracted = {}, sourceUrl = '') => {
  const retailer = extracted.retailer || '';
  const price = extracted.price;
  const productUrl = sourceUrl || '';
  if (!retailer && (price === null || price === undefined || price === '') && !productUrl) return [];
  if (!retailer && !productUrl) return [];
  return [{
    ...emptyPurchaseOption(),
    retailer,
    productUrl,
    affiliateUrl: '',
    price: price ?? '',
    currency: extracted.currency || 'INR',
    isActive: false,
  }];
};

export const normalizeProductData = (extracted = {}, options = {}) => {
  const sourceUrl = options.sourceUrl || extracted.sourceUrl || '';
  return {
    name: extracted.name || '',
    slug: extracted.slug || (extracted.name || '').toLowerCase().replace(/\s+/g, '-'),
    brand: extracted.brand || '',
    category: extracted.category || '',
    variant: extracted.variant || '',
    size: extracted.size || '',
    quantity: extracted.quantity || '',
    claims: Array.isArray(extracted.claims) ? extracted.claims.join(', ') : (extracted.claims || ''),
    description: extracted.description || '',
    images: toEditorImages(extracted.images),
    sourceUrl,
    ingredients: Array.isArray(extracted.ingredients)
      ? extracted.ingredients.join(', ')
      : parseFormIngredientList(extracted.ingredients).join(', '),
    keyIngredients: parseFormIngredientList(extracted.keyIngredients).join(', '),
    ingredientSource: extracted.ingredientSource || '',
    ingredientsTouched: false,
    skinTypes: extracted.skinTypes || [],
    concerns: extracted.concerns || [],
    fragranceFree: formatTriState(extracted.fragranceFree),
    alcoholFree: formatTriState(extracted.alcoholFree),
    essentialOilFree: formatTriState(extracted.essentialOilFree ?? null),
    pregnancyFriendly: formatTriState(extracted.pregnancyFriendly ?? null),
    purchaseOptions: purchaseOptionFromExtraction(extracted, sourceUrl),
    isActive: false,
  };
};

export const mergeExtractedIntoForm = (currentForm, extracted = {}, options = {}) => {
  const incoming = normalizeProductData(extracted, options);
  const replaceIngredients = Boolean(options.replaceIngredients);
  const keepIngredients = currentForm?.ingredientsTouched && currentForm?.ingredients?.trim() && !replaceIngredients;

  const existingImages = currentForm?.images || [];
  const mergedImages = [...existingImages];
  incoming.images.forEach((image) => {
    if (!mergedImages.some((entry) => entry.url === image.url)) mergedImages.push({ ...image, isPrimary: false });
  });
  if (mergedImages.length && !mergedImages.some((image) => image.isPrimary)) mergedImages[0].isPrimary = true;

  const existingOptions = currentForm?.purchaseOptions || [];
  const mergedOptions = [...existingOptions];
  incoming.purchaseOptions.forEach((option) => {
    const match = mergedOptions.find((entry) =>
      entry.retailer && option.retailer && entry.retailer.toLowerCase() === option.retailer.toLowerCase()
    );
    if (match) {
      if (!match.productUrl) match.productUrl = option.productUrl;
      if (match.price === '' || match.price === null || match.price === undefined) match.price = option.price;
    } else if (option.retailer || option.productUrl) {
      mergedOptions.push(option);
    }
  });

  return {
    ...currentForm,
    ...incoming,
    images: mergedImages,
    purchaseOptions: mergedOptions,
    ingredients: keepIngredients ? currentForm.ingredients : incoming.ingredients,
    ingredientsTouched: keepIngredients ? true : incoming.ingredientsTouched,
    sourceUrl: incoming.sourceUrl || currentForm.sourceUrl || '',
    isActive: currentForm.isActive,
  };
};

export const extractedDataToForm = (extracted = {}, sourceUrl = '') =>
  normalizeProductData(extracted, { sourceUrl });

export const productToForm = (product = {}, offers = []) => ({
  name: product.name || '',
  slug: product.slug || '',
  brand: product.brand?.name || product.brand || '',
  category: product.category?.name || product.category || '',
  variant: product.variant || '',
  size: product.size || '',
  quantity: product.quantity || '',
  claims: Array.isArray(product.claims) ? product.claims.join(', ') : (product.claims || ''),
  description: product.description || '',
  images: toEditorImages(product.images),
  sourceUrl: product.sourceUrl || '',
  ingredients: product.ingredientListText
    || parseFormIngredientList((product.ingredients || []).map((item) => item.name || item)).join(', '),
  keyIngredients: parseFormIngredientList((product.keyIngredients || []).map((item) => item.name || item)).join(', '),
  ingredientSource: product.ingredientSource || '',
  ingredientsTouched: false,
  skinTypes: product.skinTypes || [],
  concerns: product.concerns || [],
  fragranceFree: formatTriState(product.fragranceFree),
  alcoholFree: formatTriState(product.alcoholFree),
  essentialOilFree: formatTriState(product.essentialOilFree),
  pregnancyFriendly: formatTriState(product.pregnancyFriendly),
  purchaseOptions: offersToForm(offers),
  isActive: Boolean(product.isActive),
});

export const formToExtractedData = (form) => ({
  name: form.name.trim(),
  brand: form.brand.trim(),
  category: form.category.trim(),
  variant: (form.variant || '').trim(),
  size: (form.size || '').trim(),
  quantity: (form.quantity || '').trim(),
  description: form.description.trim(),
  images: (Array.isArray(form.images) ? form.images : String(form.images || '').split('\n'))
    .map((image) => (typeof image === 'string' ? image : image.url))
    .map((url) => String(url || '').trim())
    .filter(Boolean),
  ingredients: parseFormIngredientList(form.ingredients),
  keyIngredients: parseFormIngredientList(form.keyIngredients),
  skinTypes: form.skinTypes,
  concerns: form.concerns,
  fragranceFree: parseTriState(form.fragranceFree),
  alcoholFree: parseTriState(form.alcoholFree),
  essentialOilFree: parseTriState(form.essentialOilFree),
  pregnancyFriendly: parseTriState(form.pregnancyFriendly),
  price: form.purchaseOptions?.[0]?.price !== '' && form.purchaseOptions?.[0]?.price != null
    ? Number(form.purchaseOptions[0].price)
    : null,
  retailer: form.purchaseOptions?.[0]?.retailer?.trim() || '',
});

export const formToIntelligencePreview = (form) => ({
  name: form.name,
  brand: form.brand,
  category: form.category,
  description: form.description,
  ingredients: parseFormIngredientList(form.ingredients),
  keyIngredients: parseFormIngredientList(form.keyIngredients),
  skinTypes: form.skinTypes,
  concerns: form.concerns,
  fragranceFree: parseTriState(form.fragranceFree),
  alcoholFree: parseTriState(form.alcoholFree),
  essentialOilFree: parseTriState(form.essentialOilFree),
  pregnancyFriendly: parseTriState(form.pregnancyFriendly),
});

export const validateProductForm = (form) => {
  const errors = {};
  if (!form.name?.trim()) errors.name = 'Product name is required.';
  if (!form.brand?.trim()) errors.brand = 'Brand is required.';
  if (!form.category?.trim()) errors.category = 'Category is required.';

  (form.purchaseOptions || []).forEach((option, index) => {
    const filled = option.retailer || option.productUrl || option.affiliateUrl || option.price !== '';
    if (!filled) return;
    if (!option.retailer?.trim()) errors[`purchaseOptions.${index}.retailer`] = 'Retailer is required.';
    if (option.price === '' || option.price === null || Number.isNaN(Number(option.price))) {
      errors[`purchaseOptions.${index}.price`] = 'Enter a numeric price.';
    }
    if (!option.productUrl?.trim()) errors[`purchaseOptions.${index}.productUrl`] = 'Product URL is required.';
    if (option.isActive && !option.affiliateUrl?.trim()) {
      errors[`purchaseOptions.${index}.affiliateUrl`] = 'Affiliate URL is required for an active option.';
    }
  });

  return errors;
};

export const formToSavePayload = (form) => ({
  name: form.name.trim(),
  slug: (form.slug || form.name).trim().toLowerCase().replace(/\s+/g, '-'),
  brand: form.brand.trim(),
  category: form.category.trim(),
  variant: (form.variant || '').trim(),
  size: (form.size || '').trim(),
  quantity: (form.quantity || '').trim(),
  claims: (form.claims || '').split(/[\n,]+/).map((entry) => entry.trim()).filter(Boolean),
  description: form.description.trim(),
  sourceUrl: (form.sourceUrl || '').trim() || null,
  images: (form.images || [])
    .filter((image) => !image.file)
    .map((image) => ({
      url: image.url,
      publicId: image.publicId || '',
      isPrimary: Boolean(image.isPrimary),
      _id: image._id || undefined,
    })),
  ingredientListText: form.ingredients,
  ingredients: parseFormIngredientList(form.ingredients),
  keyIngredients: parseFormIngredientList(form.keyIngredients),
  skinTypes: form.skinTypes,
  concerns: form.concerns,
  fragranceFree: parseTriState(form.fragranceFree),
  alcoholFree: parseTriState(form.alcoholFree),
  essentialOilFree: parseTriState(form.essentialOilFree),
  pregnancyFriendly: parseTriState(form.pregnancyFriendly),
  isActive: Boolean(form.isActive),
  purchaseOptions: (form.purchaseOptions || [])
    .filter((option) => option.retailer?.trim())
    .map((option) => ({
      _id: option._id || undefined,
      retailer: option.retailer.trim(),
      productUrl: option.productUrl.trim(),
      affiliateUrl: option.affiliateUrl.trim() || null,
      price: Number(option.price),
      currency: option.currency || 'INR',
      isActive: Boolean(option.isActive),
    })),
});

export const formatPrice = (price, currency = 'INR') => {
  if (price === '' || price === null || price === undefined || Number.isNaN(Number(price))) return '—';
  const amount = Number(price);
  if (currency === 'INR') {
    return `₹${amount.toLocaleString('en-IN')}`;
  }
  return `${amount.toLocaleString()} ${currency}`;
};
