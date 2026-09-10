export const API_PATHS = {


 skinProfile: {
  base: '/api/skin-profile',
  completeQuestionnaire:
    '/api/skin-profile/complete-questionnaire',
  saveAnonymous:
    '/api/skin-profile/save-anonymous',
},

anonymousConsent:
  '/api/anonymous-analysis/consent',
anonymousAnalysis:
  '/api/anonymous-analysis',
  products: {
    list: '/api/products',
    search: '/api/products/search',
    byId: (id) => `/api/products/${id}`,
    byCategory: (categoryId) => `/api/products/category/${categoryId}`,
    byBrand: (brandId) => `/api/products/brand/${brandId}`,
    offers: (productId) => `/api/products/${productId}/offers`,
    offerById: (productId, offerId) => `/api/products/${productId}/offers/${offerId}`,
    create: '/api/products',
    update: (id) => `/api/products/${id}`,
    delete: (id) => `/api/products/${id}`,
    publish: (id) => `/api/products/${id}/publish`,
    toggleStatus: (id) => `/api/products/${id}/toggle-status`,
    intelligenceInput: (id) => `/api/products/${id}/intelligence-input`,
    generateIntelligence: (id) => `/api/products/${id}/generate-intelligence`,
    approveIntelligence: (id) => `/api/products/${id}/approve-intelligence`,
    rejectIntelligence: (id) => `/api/products/${id}/reject-intelligence`,
    uploadImage: (id) => `/api/products/${id}/images`,
    deleteImage: (id, imageId) => `/api/products/${id}/images/${imageId}`,
    setPrimaryImage: (id, imageId) => `/api/products/${id}/images/${imageId}/primary`,
  },
  brands: {
    list: '/api/brands',
  },
  categories: {
    list: '/api/categories',
  },
  retailers: {
    list: '/api/retailers',
  },
  sellerDiscovery: {
    discover: '/api/seller-discovery/discover',
    candidates: '/api/seller-discovery/candidates',
    updateCandidate: (id) => `/api/seller-discovery/candidates/${id}`,
    deleteCandidate: (id) => `/api/seller-discovery/candidates/${id}`,
  },
  recommendations: {
    generate: '/api/recommendations/generate',
    latest: '/api/recommendations/latest',
    byId: (id) => `/api/recommendations/${id}`,
    products: (id) => `/api/recommendations/${id}/products`,
  },
  skinProfile: {
    base: '/api/skin-profile',
    completeQuestionnaire: '/api/skin-profile/complete-questionnaire',
    saveAnonymous: '/api/skin-profile/save-anonymous',
  },
  anonymousAnalysis: '/api/anonymous-analysis',
  chat: {
    list: '/api/chat',
    create: '/api/chat',
    byId: (id) => `/api/chat/${id}`,
    messages: (id) => `/api/chat/${id}/messages`,
  },
  admin: {
    dashboard: '/api/admin/dashboard',
    recentImports: '/api/admin/recent-imports',
    productStats: '/api/admin/product-stats',
    clickStats: '/api/admin/click-stats',
    userStats: '/api/admin/user-stats',
  },
  auth: {
    firebase: '/api/auth/firebase',
    me: '/api/auth/me',
  },
  productImports: {
    list: '/api/product-imports',
    create: '/api/product-imports',
    byId: (id) => `/api/product-imports/${id}`,
    extract: (id) => `/api/product-imports/${id}/extract`,
    extractedData: (id) => `/api/product-imports/${id}/extracted-data`,
    approve: (id) => `/api/product-imports/${id}/approve`,
    reject: (id) => `/api/product-imports/${id}/reject`,
    publish: (id) => `/api/product-imports/${id}/publish`,
    intelligenceInput: (id) => `/api/product-imports/${id}/intelligence-input`,
  },
  adminIntelligence: {
    audit: '/api/admin/intelligence/audit',
    testMatrix: '/api/admin/intelligence/test-matrix',
    runMatchingAudit: '/api/admin/intelligence/run-matching-audit',
    test: '/api/admin/intelligence/test',
    previewInput: '/api/admin/intelligence/preview-input',
  },
  productClicks: {
    track: '/api/product-clicks',
  },
  research: {
    knowledge: '/api/research/ingredient-knowledge',
    knowledgeById: (id) => `/api/research/ingredient-knowledge/${id}`,
    knowledgeMatch: '/api/research/ingredient-knowledge/match',
    knowledgeImport: '/api/research/ingredient-knowledge/import',
    knowledgeVerify: (id) => `/api/research/ingredient-knowledge/${id}/verify`,
    queue: '/api/research/queue',
    queueById: (id) => `/api/research/queue/${id}`,
    queueRun: (id) => `/api/research/queue/${id}/run`,
    research: '/api/research/research',
    queueApprove: (id) => `/api/research/queue/${id}/approve`,
    queueReject: (id) => `/api/research/queue/${id}/reject`,
  },
};

export const ROUTES = {
  home: '/',
  login: '/login',
  signup: '/signup',
  onboarding: '/onboarding',
  dashboard: '/dashboard',
  products: '/products',
  productDetail: (id) => `/products/${id}`,
  profile: '/profile',
  admin: '/admin',
  adminProducts: '/admin/products',
  adminImports: '/admin/product-imports',
};
