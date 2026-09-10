export const generateEarnKaroLink = async ({ originalUrl }) => {
  const apiKey = process.env.EARNKARO_API_KEY;
  const apiSecret = process.env.EARNKARO_API_SECRET;

  if (!originalUrl) {
    return { success: false, affiliateUrl: null, message: 'Original URL is required to generate an EarnKaro affiliate link.' };
  }

  if (!apiKey || !apiSecret) {
    return {
      success: false,
      affiliateUrl: null,
      message: 'EarnKaro credentials are not configured yet. The original product URL has been preserved.',
    };
  }

  return {
    success: false,
    affiliateUrl: null,
    message: 'EarnKaro integration is not yet connected to a live provider. The direct link is preserved as fallback.',
  };
};

export default generateEarnKaroLink;
