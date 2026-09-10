export const semanticSearchProducts = async ({ query, limit = 8, filters = {} }) => {
  return {
    query,
    limit,
    filters,
    results: [],
    provider: 'placeholder',
    message: 'MongoDB Atlas Vector Search is not configured yet. This is an interface placeholder.',
  };
};

export default semanticSearchProducts;
