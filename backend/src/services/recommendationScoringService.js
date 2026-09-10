export const normalizeNumber = (value, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

export const buildProfileSnapshot = (skinProfile = {}) => ({
  skinType: skinProfile.skinType || 'unknown',
  sensitivity: skinProfile.sensitivity || 'unknown',
  morningSkinFeel: skinProfile.morningSkinFeel || 'unknown',
  responseToNewProducts: skinProfile.responseToNewProducts || 'unknown',

  // New onboarding fields
  primaryGoal: skinProfile.primaryGoal || 'unknown',
  concerns: skinProfile.concerns || [],
  avoidancePreferences: skinProfile.avoidancePreferences || [],

  // Safety / preference data
  allergies: skinProfile.allergies || [],
  avoidedIngredients: skinProfile.avoidedIngredients || [],
  mustHavePreferences: skinProfile.mustHavePreferences || [],

  // Kept for backward compatibility with older recommendation records.
  ageRange: skinProfile.ageRange || 'unknown',
  currentProducts: skinProfile.currentProducts || [],
  sunscreenHabit: skinProfile.sunscreenHabit || 'unknown',

  onboardingAnswers: skinProfile.onboardingAnswers || {},

  // Budget is retained in the snapshot for historical/debugging purposes.
  // It should not determine the core recommendation ranking.
  budget: skinProfile.budget || { min: 0, max: 5000 },
});

const clampScore = (value) =>
  Math.max(0, Math.min(100, Math.round(value)));

const normalizeTerm = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

const normalizeConcernKey = (value) =>
  normalizeTerm(value).replace(/[_\s]+/g, '-');

const normalizeSkinType = (value) =>
  normalizeTerm(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+skin(?: types?)?$/i, '')
    .trim();

const uniqueStrings = (values = []) =>
  [...new Set(values.filter(Boolean))];

const getSkinTypeCompatibility = ({
  profileSkinType,
  productSkinTypes = [],
  intelligence = {},
}) => {
  const userType = normalizeSkinType(profileSkinType);

  if (!userType || userType === 'unknown') {
    return {
      status: 'unknown',
      score: null,
    };
  }

  const listedTypes = productSkinTypes
    .flatMap((value) =>
      normalizeSkinType(value).split(
        /\s+to\s+|\s*&\s*|\s*,\s*/
      )
    )
    .map((value) => value.trim())
    .filter(Boolean);

  if (listedTypes.length) {
    if (
      listedTypes.includes('all') ||
      listedTypes.includes('all skin')
    ) {
      return {
        status: 'compatible',
        score: 1,
      };
    }

    if (listedTypes.includes(userType)) {
      return {
        status: 'compatible',
        score: 1,
      };
    }

    if (
      userType === 'sensitive' &&
      listedTypes.includes('sensitive')
    ) {
      return {
        status: 'compatible',
        score: 1,
      };
    }

    return {
      status: 'incompatible',
      score: 0,
    };
  }

  const compatibilityValue = normalizeNumber(
    intelligence.skinTypeCompatibility?.[userType],
    -1
  );

  if (compatibilityValue < 0) {
    return {
      status: 'unknown',
      score: null,
    };
  }

  return {
    status:
      compatibilityValue < 0.45
        ? 'incompatible'
        : compatibilityValue >= 0.7
          ? 'compatible'
          : 'moderate',
    score: compatibilityValue,
  };
};

const goalConcerns = {
  'clearer-skin': ['acne'],
  'brighter-even': [
    'pigmentation',
    'dark-spots',
    'dullness',
    'sun-damage',
  ],
  hydration: ['dryness', 'dehydration'],
  'smoother-texture': [
    'uneven-texture',
    'large-pores',
  ],
  'less-oiliness': [
    'excess-oil',
    'large-pores',
    'acne',
  ],
  'anti-aging': [
    'aging',
    'fine-lines',
  ],
  'healthier-skin': [
    'redness',
    'dryness',
    'dehydration',
  ],
};

const getIngredientTerms = (ingredient) => {
  const terms = new Set();

  if (typeof ingredient === 'string') {
    const normalized = normalizeTerm(ingredient);

    if (normalized) {
      terms.add(normalized);
    }

    return [...terms];
  }

  const name = normalizeTerm(ingredient?.name);

  if (name) {
    terms.add(name);
  }

  if (Array.isArray(ingredient?.aliases)) {
    ingredient.aliases.forEach((alias) => {
      const normalizedAlias = normalizeTerm(alias);

      if (normalizedAlias) {
        terms.add(normalizedAlias);
      }
    });
  }

  return [...terms];
};

const tokenizeTerm = (value) =>
  normalizeTerm(value)
    .split(/[,/()|]+/)
    .flatMap((segment) => segment.split(/\s+/))
    .filter((token) => token.length >= 3);

const termsMatch = (ingredientTerm, searchTerm) => {
  const normalizedIngredient = normalizeTerm(ingredientTerm);
  const normalizedSearch = normalizeTerm(searchTerm);

  if (!normalizedIngredient || !normalizedSearch) {
    return false;
  }

  if (normalizedIngredient === normalizedSearch) {
    return true;
  }

  const ingredientTokens = tokenizeTerm(normalizedIngredient);
  const searchTokens = tokenizeTerm(normalizedSearch);

  if (searchTokens.length === 1) {
    return ingredientTokens.includes(searchTokens[0]);
  }

  return searchTokens.every((token) =>
    ingredientTokens.includes(token)
  );
};

const collectProductIngredientEntries = (product = {}) => {
  const entries = [];

  (product.ingredients || []).forEach((ingredient) => {
    entries.push(ingredient);
  });

  (product.keyIngredients || []).forEach((ingredient) => {
    entries.push(ingredient);
  });

  const intelligenceIngredients =
    product.productIntelligence?.ingredientAnalysis || [];

  intelligenceIngredients.forEach((entry) => {
    if (entry?.ingredient) {
      entries.push(entry.ingredient);
    }
  });

  return entries;
};

const findIngredientMatches = (
  searchTerms,
  productIngredients
) => {
  const matches = [];

  searchTerms.forEach((searchTerm) => {
    const normalizedSearch = normalizeTerm(searchTerm);

    if (normalizedSearch.length < 3) {
      return;
    }

    productIngredients.forEach((ingredient) => {
      const ingredientLabel =
        typeof ingredient === 'string'
          ? ingredient
          : ingredient?.name || ingredient?.ingredient;

      const matched = getIngredientTerms(ingredient).some(
        (term) => termsMatch(term, normalizedSearch)
      );

      if (matched) {
        matches.push(
          ingredientLabel || normalizedSearch
        );
      }
    });
  });

  return uniqueStrings(matches);
};

/**
 * Converts all explicit ingredient/allergy avoidance data
 * into searchable terms.
 *
 * The new onboarding avoidancePreferences are handled
 * separately because some of them are formulation-level
 * preferences rather than individual ingredients.
 */
const buildUserAvoidanceTerms = (skinProfile = {}) => {
  const terms = [];

  (skinProfile.allergies || []).forEach((allergy) => {
    const normalized = normalizeTerm(allergy);

    if (normalized) {
      terms.push(normalized);
    }
  });

  (skinProfile.avoidedIngredients || []).forEach(
    (ingredient) => {
      if (typeof ingredient === 'string') {
        const normalized = normalizeTerm(ingredient);

        if (normalized) {
          terms.push(normalized);
        }

        return;
      }

      getIngredientTerms(ingredient).forEach((term) =>
        terms.push(term)
      );
    }
  );

  // Legacy onboarding compatibility.
  const rawAvoidedIngredients =
    skinProfile.onboardingAnswers?.avoidedIngredients || [];

  rawAvoidedIngredients.forEach((ingredient) => {
    const normalized = normalizeTerm(ingredient);

    if (normalized) {
      terms.push(normalized);
    }
  });

  const rawAvoidedOther = normalizeTerm(
    skinProfile.onboardingAnswers?.avoidedIngredientsOther
  );

  if (rawAvoidedOther) {
    terms.push(rawAvoidedOther);
  }

  return uniqueStrings(terms);
};

/**
 * Returns explicit formulation-level avoidance preferences.
 */
const getAvoidancePreferences = (skinProfile = {}) => {
  const preferences = Array.isArray(
    skinProfile.avoidancePreferences
  )
    ? skinProfile.avoidancePreferences
    : [];

  return preferences.filter(
    (preference) =>
      preference && preference !== 'nothing-to-avoid'
  );
};

const getConcernCompatibilityScore = (
  concernCompatibility = {},
  profileConcerns = []
) => {
  if (!profileConcerns.length) {
    return null;
  }

  const normalizedMap = Object.entries(
    concernCompatibility || {}
  ).reduce(
    (accumulator, [key, value]) => {
      accumulator[normalizeConcernKey(key)] =
        normalizeNumber(value, 0);

      return accumulator;
    },
    {}
  );

  const scores = profileConcerns
    .map((concern) => {
      const normalizedConcern =
        normalizeConcernKey(concern);

      if (
        Object.prototype.hasOwnProperty.call(
          normalizedMap,
          normalizedConcern
        )
      ) {
        return normalizedMap[normalizedConcern];
      }

      const fuzzyMatch = Object.entries(
        normalizedMap
      ).find(
        ([key]) =>
          key.includes(normalizedConcern) ||
          normalizedConcern.includes(key)
      );

      return fuzzyMatch
        ? normalizeNumber(fuzzyMatch[1], 0)
        : null;
    })
    .filter((score) => score !== null);

  if (!scores.length) {
    return null;
  }

  return (
    scores.reduce((sum, score) => sum + score, 0) /
    scores.length
  );
};

const getMatchedProfileConcerns = ({
  profileConcerns = [],
  productConcerns = [],
  concernCompatibility = {},
  ingredientAnalysis = [],
}) => {
  const matched = new Set();

  profileConcerns.forEach((concern) => {
    const normalizedConcern =
      normalizeConcernKey(concern);

    if (
      productConcerns.some(
        (productConcern) =>
          normalizeConcernKey(productConcern) ===
          normalizedConcern
      )
    ) {
      matched.add(concern);
    }

    Object.keys(concernCompatibility || {}).forEach(
      (key) => {
        const normalizedKey =
          normalizeConcernKey(key);

        if (
          normalizedKey === normalizedConcern ||
          normalizedKey.includes(normalizedConcern) ||
          normalizedConcern.includes(normalizedKey)
        ) {
          if (
            normalizeNumber(
              concernCompatibility[key],
              0
            ) >= 0.55
          ) {
            matched.add(concern);
          }
        }
      }
    );

    ingredientAnalysis.forEach((entry) => {
      const relevantConcerns = Array.isArray(
        entry?.relevantConcerns
      )
        ? entry.relevantConcerns
        : [];

      if (
        relevantConcerns.some(
          (relevantConcern) =>
            normalizeConcernKey(relevantConcern) ===
            normalizedConcern
        )
      ) {
        matched.add(concern);
      }
    });
  });

  return [...matched];
};

const getUnmatchedProfileConcerns = (
  profileConcerns = [],
  matchedConcerns = []
) =>
  profileConcerns.filter(
    (concern) => !matchedConcerns.includes(concern)
  );

const scoreHydrationAndOilControl = ({
  skinProfile = {},
  intelligence = {},
}) => {
  let score = 0;
  const matchedFactors = [];

  const hydrationProfile = normalizeTerm(
    intelligence.hydrationProfile
  );

  const oilControlProfile = normalizeTerm(
    intelligence.oilControlProfile
  );

  const profileConcerns =
    skinProfile.concerns || [];

  const needsHydration =
    skinProfile.skinType === 'dry' ||
    profileConcerns.includes('dryness') ||
    profileConcerns.includes('dehydration') ||
    ['dry', 'combination-feel'].includes(
      skinProfile.morningSkinFeel
    );

  const needsOilControl =
    skinProfile.skinType === 'oily' ||
    profileConcerns.includes('excess-oil') ||
    profileConcerns.includes('acne') ||
    ['slightly-oily', 'very-oily'].includes(
      skinProfile.morningSkinFeel
    );

  if (needsHydration && hydrationProfile) {
    if (
      /(rich|high|intense|deep)/.test(
        hydrationProfile
      )
    ) {
      score += 8;
      matchedFactors.push(
        'Hydration profile suits dry or dehydrated skin'
      );
    } else if (
      /(moderate|balanced|medium)/.test(
        hydrationProfile
      )
    ) {
      score += 4;
      matchedFactors.push(
        'Offers moderate hydration support'
      );
    } else if (
      /(light|low|minimal)/.test(
        hydrationProfile
      )
    ) {
      score -= 4;
    }
  }

  if (needsOilControl && oilControlProfile) {
    if (
      /(strong|high|effective|mattifying)/.test(
        oilControlProfile
      )
    ) {
      score += 8;
      matchedFactors.push(
        'Oil-control profile suits oily or congestion-prone skin'
      );
    } else if (
      /(moderate|balanced|medium)/.test(
        oilControlProfile
      )
    ) {
      score += 4;
      matchedFactors.push(
        'Offers moderate oil-control support'
      );
    } else if (
      /(low|minimal|none)/.test(
        oilControlProfile
      )
    ) {
      score -= 4;
    }
  }

  return {
    score,
    matchedFactors,
  };
};

const scoreIngredientBenefits = ({
  profileConcerns = [],
  ingredientAnalysis = [],
}) => {
  if (
    !profileConcerns.length ||
    !Array.isArray(ingredientAnalysis) ||
    !ingredientAnalysis.length
  ) {
    return {
      score: 0,
      matchedFactors: [],
      relevantIngredients: [],
    };
  }

  const relevantIngredients = [];
  let score = 0;

  ingredientAnalysis.forEach((entry) => {
    const relevantConcerns = Array.isArray(
      entry?.relevantConcerns
    )
      ? entry.relevantConcerns
      : [];

    const matchedConcernCount =
      profileConcerns.filter((concern) =>
        relevantConcerns.some(
          (relevantConcern) =>
            normalizeConcernKey(
              relevantConcern
            ) === normalizeConcernKey(concern)
        )
      ).length;

    if (matchedConcernCount > 0) {
      relevantIngredients.push(
        entry.ingredient
      );

      score += Math.min(
        6,
        matchedConcernCount * 2
      );
    }

    if (entry?.potentialSensitivityConcern) {
      score -= 1;
    }
  });

  const matchedFactors =
    relevantIngredients.length
      ? [
          `Contains ingredients relevant to your concerns (${uniqueStrings(
            relevantIngredients
          )
            .slice(0, 3)
            .join(', ')})`,
        ]
      : [];

  return {
    score: Math.min(12, score),
    matchedFactors,
    relevantIngredients:
      uniqueStrings(relevantIngredients),
  };
};

const scoreAvoidanceSignals = ({
  avoidanceSignals = {},
  avoidanceTerms = [],
}) => {
  if (
    !avoidanceTerms.length ||
    !avoidanceSignals ||
    typeof avoidanceSignals !== 'object'
  ) {
    return {
      conflict: false,
      matchedFactors: [],
      concernsNotMatched: [],
    };
  }

  const signalEntries =
    Object.entries(avoidanceSignals);

  const matchedSignals = [];

  avoidanceTerms.forEach((term) => {
    signalEntries.forEach(([key, value]) => {
      const keyMatches = termsMatch(
        key,
        term
      );

      const valueMatches = termsMatch(
        String(value),
        term
      );

      if (keyMatches || valueMatches) {
        matchedSignals.push(
          typeof value === 'string' &&
            value.trim()
            ? value.trim()
            : key
        );
      }
    });
  });

  if (!matchedSignals.length) {
    return {
      conflict: false,
      matchedFactors: [],
      concernsNotMatched: [],
    };
  }

  return {
    conflict: true,
    matchedFactors: [],
    concernsNotMatched: [
      `avoidance signal: ${uniqueStrings(
        matchedSignals
      )[0]}`,
    ],
    explanation: `Contains an ingredient or formulation signal you asked to avoid (${uniqueStrings(
      matchedSignals
    )[0]}).`,
  };
};

/**
 * Scores the new onboarding avoidance preferences.
 *
 * These are ranking signals here.
 * The matching engine remains responsible for deciding
 * whether a product is actually eligible.
 */
const scoreAvoidancePreferences = ({
  preferences = [],
  product = {},
  intelligence = {},
  productIngredients = [],
}) => {
  let score = 0;

  const matchedFactors = [];
  const concernsNotMatched = [];
  const potentialConcerns = [];

  if (!preferences.length) {
    return {
      score,
      matchedFactors,
      concernsNotMatched,
      potentialConcerns,
      hardConflict: false,
    };
  }

  const avoidanceSignals =
    intelligence.avoidanceSignals || {};

  const signalText = JSON.stringify(
    avoidanceSignals
  ).toLowerCase();

  const ingredientText = productIngredients
    .map((ingredient) =>
      normalizeTerm(
        typeof ingredient === 'string'
          ? ingredient
          : ingredient?.name ||
              ingredient?.ingredient
      )
    )
    .join(' ');

  const formulationText =
    `${ingredientText} ${signalText} ${JSON.stringify(
      intelligence.qualityAssessment || {}
    ).toLowerCase()}`;

  preferences.forEach((preference) => {
    switch (preference) {
      case 'fragrance': {
        if (product.fragranceFree === true) {
          score += 5;
          matchedFactors.push(
            'Fragrance-free'
          );
        } else if (
          product.fragranceFree === false
        ) {
          score -= 12;
          concernsNotMatched.push(
            'fragrance avoidance'
          );
          potentialConcerns.push(
            'Contains fragrance despite your preference to avoid it.'
          );
        }

        break;
      }

      case 'essential-oils': {
        const explicitEssentialOilFree =
          product.essentialOilFree;

        if (
          explicitEssentialOilFree === true
        ) {
          score += 5;
          matchedFactors.push(
            'Essential-oil-free'
          );
        } else if (
          explicitEssentialOilFree === false ||
          /(essential oil|essential-oil)/.test(
            formulationText
          )
        ) {
          score -= 12;
          concernsNotMatched.push(
            'essential oil avoidance'
          );
          potentialConcerns.push(
            'Contains essential-oil signals despite your preference to avoid them.'
          );
        }

        break;
      }

      case 'alcohol': {
        if (product.alcoholFree === true) {
          score += 5;
          matchedFactors.push(
            'Alcohol-free'
          );
        } else if (
          product.alcoholFree === false
        ) {
          score -= 12;
          concernsNotMatched.push(
            'alcohol avoidance'
          );
          potentialConcerns.push(
            'Contains alcohol despite your preference to avoid it.'
          );
        }

        break;
      }

      case 'harsh-exfoliants': {
        const hasMultipleAcids =
          [
            'lactic acid',
            'glycolic acid',
            'salicylic acid',
          ].filter((acid) =>
            ingredientText.includes(acid)
          ).length >= 2;

        const harshSignal =
          /(harsh|aggressive exfol|strong exfol|physical exfol|scrub)/.test(
            formulationText
          );

        if (
          hasMultipleAcids ||
          harshSignal
        ) {
          score -= 10;
          concernsNotMatched.push(
            'harsh exfoliant avoidance'
          );
          potentialConcerns.push(
            'Contains exfoliation signals that may be too aggressive for your preferences.'
          );
        } else {
          score += 3;
          matchedFactors.push(
            'No strong harsh-exfoliation signals'
          );
        }

        break;
      }

      case 'irritating-ingredients': {
        const sensitivityFlags =
          Array.isArray(
            intelligence.ingredientAnalysis
          )
            ? intelligence.ingredientAnalysis.filter(
                (entry) =>
                  entry?.potentialSensitivityConcern
              )
            : [];

        if (sensitivityFlags.length) {
          score -= Math.min(
            10,
            sensitivityFlags.length * 3
          );

          concernsNotMatched.push(
            'irritating ingredient avoidance'
          );

          potentialConcerns.push(
            `Contains ingredients flagged for potential irritation (${sensitivityFlags
              .slice(0, 2)
              .map(
                (entry) =>
                  entry.ingredient
              )
              .filter(Boolean)
              .join(', ')}).`
          );
        } else {
          score += 3;
          matchedFactors.push(
            'No major irritation signals found'
          );
        }

        break;
      }

      case 'known-allergies': {
        // Actual allergy matching is handled separately
        // using profile.allergies and ingredient matching.
        // This preference itself is not treated as an
        // allergy because no allergy name has been supplied.
        break;
      }

      default:
        break;
    }
  });

  return {
    score,
    matchedFactors,
    concernsNotMatched,
    potentialConcerns,
    hardConflict: false,
  };
};

const buildScoreExplanation = ({
  matchedFactors = [],
  potentialConcerns = [],
  qualityScore = null,
}) => {
  const positiveLines =
    uniqueStrings(matchedFactors);

  const concernLines =
    uniqueStrings(potentialConcerns);

  if (qualityScore > 0) {
    positiveLines.push(
      `Product quality score: ${qualityScore}/10`
    );
  }

  let explanation =
    positiveLines.join('\n');

  if (concernLines.length) {
    if (explanation) {
      explanation += '\n\n';
    }

    explanation +=
      `Potential concern${
        concernLines.length > 1
          ? 's'
          : ''
      }:\n`;

    explanation += concernLines
      .map((line) => `- ${line}`)
      .join('\n');
  }

  return (
    explanation ||
    'This product was evaluated against your skin profile and available product information.'
  );
};

export const scoreProductCompatibility = ({
  product,
  skinProfile,
  offerPrice,
  currentCategory,
}) => {
  if (!product) {
    return {
      score: 0,
      matchedFactors: [],
      concernsMatched: [],
      concernsNotMatched: [],
      explanation:
        'No product available for scoring.',
    };
  }

  const profile = skinProfile || {};
  const intelligence =
    product.productIntelligence || {};

  const profileConcerns =
    Array.isArray(profile.concerns)
      ? profile.concerns
      : [];

  const productConcerns =
    Array.isArray(product.concerns)
      ? product.concerns
      : [];

  const productSkinTypes =
    Array.isArray(product.skinTypes)
      ? product.skinTypes
      : [];

  const currentOfferPrice =
    normalizeNumber(offerPrice, 0);

  let score = 50;

  const matchedFactors = [];
  const concernsNotMatched = [];
  const potentialConcerns = [];

  const skinTypeCompatibility =
    getSkinTypeCompatibility({
      profileSkinType: profile.skinType,
      productSkinTypes,
      intelligence,
    });

  const productIngredients =
    collectProductIngredientEntries(product);

  const allergyTerms = uniqueStrings(
    (profile.allergies || [])
      .map((entry) =>
        normalizeTerm(entry)
      )
      .filter(
        (entry) => entry.length >= 3
      )
  );

  const avoidanceTerms =
    buildUserAvoidanceTerms(profile);

  const avoidancePreferences =
    getAvoidancePreferences(profile);

  const allergyMatches =
    findIngredientMatches(
      allergyTerms,
      productIngredients
    );

  const avoidanceMatches =
    findIngredientMatches(
      avoidanceTerms.filter(
        (term) =>
          !allergyTerms.includes(term)
      ),
      productIngredients
    );

  /*
   * -------------------------------------------------------
   * 1. SKIN TYPE
   * -------------------------------------------------------
   */

  if (
    profile.skinType &&
    profile.skinType !== 'unknown'
  ) {
    const compatibilityValue =
      normalizeNumber(
        intelligence
          .skinTypeCompatibility?.[
          profile.skinType
        ],
        -1
      );

    if (
      skinTypeCompatibility.status ===
      'incompatible'
    ) {
      score -= 35;

      concernsNotMatched.push(
        'skin type incompatibility'
      );

      potentialConcerns.push(
        `Not a reliable match for ${profile.skinType} skin based on explicit suitability data.`
      );
    } else if (compatibilityValue >= 0) {
      if (compatibilityValue >= 0.7) {
        score += 18;

        matchedFactors.push(
          `Good match for ${profile.skinType} skin`
        );
      } else if (
        compatibilityValue >= 0.45
      ) {
        score += 10;

        matchedFactors.push(
          `Moderate fit for ${profile.skinType} skin`
        );
      } else {
        score -= 12;

        concernsNotMatched.push(
          `${profile.skinType} skin compatibility`
        );

        potentialConcerns.push(
          `May not be well suited to ${profile.skinType} skin based on available formulation signals.`
        );
      }
    }

    if (
      skinTypeCompatibility.status ===
        'compatible' &&
      productSkinTypes.length
    ) {
      score += 6;

      if (
        !matchedFactors.some((factor) =>
          factor.includes(
            profile.skinType
          )
        )
      ) {
        matchedFactors.push(
          `Listed as suitable for ${profile.skinType} skin`
        );
      }
    } else if (
      productSkinTypes.length &&
      skinTypeCompatibility.status ===
        'unknown'
    ) {
      score -= 6;

      concernsNotMatched.push(
        'brand-listed skin type coverage'
      );
    }
  }

  /*
   * -------------------------------------------------------
   * 2. CONCERNS
   * -------------------------------------------------------
   */

  const concernCompatibilityAverage =
    getConcernCompatibilityScore(
      intelligence.concernCompatibility,
      profileConcerns
    );

  const concernsMatched =
    getMatchedProfileConcerns({
      profileConcerns,
      productConcerns,
      concernCompatibility:
        intelligence.concernCompatibility,
      ingredientAnalysis:
        intelligence.ingredientAnalysis,
    });

  if (
    concernCompatibilityAverage !== null
  ) {
    if (
      concernCompatibilityAverage >= 0.7
    ) {
      score += 20;

      matchedFactors.push(
        `Strong support for your concerns (${
          concernsMatched
            .slice(0, 3)
            .join(', ') ||
          'profile goals'
        })`
      );
    } else if (
      concernCompatibilityAverage >=
      0.45
    ) {
      score += 12;

      matchedFactors.push(
        `Supports some of your concerns (${
          concernsMatched
            .slice(0, 3)
            .join(', ') ||
          'profile goals'
        })`
      );
    } else {
      score -= 10;

      concernsNotMatched.push(
        'concern compatibility'
      );

      potentialConcerns.push(
        'May not strongly address your main skin concerns.'
      );
    }
  }

  const brandConcernMatches =
    productConcerns.filter(
      (concern) =>
        profileConcerns.includes(
          concern
        )
    );

  if (brandConcernMatches.length) {
    score += Math.min(
      8,
      brandConcernMatches.length * 3
    );

    brandConcernMatches.forEach(
      (concern) => {
        if (
          !concernsMatched.includes(
            concern
          )
        ) {
          concernsMatched.push(
            concern
          );
        }
      }
    );

    if (
      concernCompatibilityAverage ===
      null
    ) {
      matchedFactors.push(
        `Brand information addresses ${brandConcernMatches.join(', ')}`
      );
    }
  }

  const unmatchedConcerns =
    getUnmatchedProfileConcerns(
      profileConcerns,
      concernsMatched
    );

  if (unmatchedConcerns.length) {
    score -= Math.min(
      8,
      unmatchedConcerns.length * 2
    );

    concernsNotMatched.push(
      ...unmatchedConcerns.slice(0, 3)
    );
  }

  /*
   * -------------------------------------------------------
   * 3. SENSITIVITY
   * -------------------------------------------------------
   */

  if (
    profile.sensitivity &&
    profile.sensitivity !== 'unknown'
  ) {
    const sensitivityValue =
      normalizeNumber(
        intelligence
          .sensitivitySuitability?.[
          profile.sensitivity
        ],
        -1
      );

    if (sensitivityValue >= 0.7) {
      score += 16;

      matchedFactors.push(
        `Suitable for ${profile.sensitivity} sensitivity`
      );
    } else if (
      sensitivityValue >= 0.45
    ) {
      score += 8;

      matchedFactors.push(
        `Moderate suitability for ${profile.sensitivity} sensitivity`
      );
    } else if (
      sensitivityValue >= 0
    ) {
      score -= 14;

      concernsNotMatched.push(
        `${profile.sensitivity} sensitivity suitability`
      );

      potentialConcerns.push(
        `May not be ideal for ${profile.sensitivity} sensitivity.`
      );
    }
  }

  /*
   * -------------------------------------------------------
   * 4. PRIMARY GOAL
   *
   * IMPORTANT:
   * This is deliberately outside the sensitivity block.
   * The old version only scored the goal when a
   * sensitivity value existed.
   * -------------------------------------------------------
   */

  const goalConcernKeys =
    goalConcerns[profile.primaryGoal] ||
    [];

  const goalMatches =
    productConcerns.filter(
      (concern) =>
        goalConcernKeys.includes(
          normalizeConcernKey(
            concern
          )
        )
    );

  const goalIngredientMatches =
    Array.isArray(
      intelligence.ingredientAnalysis
    )
      ? intelligence.ingredientAnalysis.filter(
          (entry) =>
            Array.isArray(
              entry?.relevantConcerns
            ) &&
            entry.relevantConcerns.some(
              (concern) =>
                goalConcernKeys.includes(
                  normalizeConcernKey(
                    concern
                  )
                )
            )
        )
      : [];

  if (
    goalMatches.length ||
    goalIngredientMatches.length
  ) {
    score += Math.min(
      14,
      goalMatches.length * 5 +
        Math.min(
          4,
          goalIngredientMatches.length * 2
        )
    );

    matchedFactors.push(
      `Supports your ${normalizeTerm(
        profile.primaryGoal
      ).replaceAll('-', ' ')} goal`
    );
  }

  /*
   * -------------------------------------------------------
   * 5. MORNING SKIN FEEL
   * -------------------------------------------------------
   */

  if (
    profile.morningSkinFeel &&
    profile.morningSkinFeel !==
      'unknown'
  ) {
    const needsHydration = [
      'dry',
      'combination-feel',
    ].includes(
      profile.morningSkinFeel
    );

    const needsOilControl = [
      'slightly-oily',
      'very-oily',
    ].includes(
      profile.morningSkinFeel
    );

    if (
      needsHydration &&
      /(rich|high|intense|deep|moderate|balanced)/.test(
        normalizeTerm(
          intelligence.hydrationProfile
        )
      )
    ) {
      score += 4;

      matchedFactors.push(
        'Matches your morning skin feel'
      );
    } else if (
      needsOilControl &&
      /(strong|high|effective|mattifying|moderate|balanced)/.test(
        normalizeTerm(
          intelligence.oilControlProfile
        )
      )
    ) {
      score += 4;

      matchedFactors.push(
        'Matches your morning skin feel'
      );
    }
  }

  /*
   * -------------------------------------------------------
   * 6. REACTION TO NEW PRODUCTS
   * -------------------------------------------------------
   */

  if (
    ['often-irritated',
      'very-easily-irritated'].includes(
      profile.responseToNewProducts
    )
  ) {
    if (
      product.fragranceFree &&
      product.alcoholFree &&
      product.essentialOilFree
    ) {
      score += 6;

      matchedFactors.push(
        'Gentler profile for reactive skin'
      );
    }
  }

  /*
   * -------------------------------------------------------
   * 7. NEW AVOIDANCE PREFERENCES
   * -------------------------------------------------------
   */

  const avoidancePreferenceScore =
    scoreAvoidancePreferences({
      preferences:
        avoidancePreferences,
      product,
      intelligence,
      productIngredients,
    });

  score +=
    avoidancePreferenceScore.score;

  matchedFactors.push(
    ...avoidancePreferenceScore.matchedFactors
  );

  concernsNotMatched.push(
    ...avoidancePreferenceScore.concernsNotMatched
  );

  potentialConcerns.push(
    ...avoidancePreferenceScore.potentialConcerns
  );

  /*
   * -------------------------------------------------------
   * 8. EXPLICIT MUST-HAVE PREFERENCES
   * -------------------------------------------------------
   */

  if (
    product.fragranceFree &&
    (
      profile.sensitivity === 'high' ||
      (
        profile.mustHavePreferences ||
        []
      ).includes('fragrance-free')
    )
  ) {
    score += 5;

    matchedFactors.push(
      'Fragrance-free'
    );
  }

  if (
    product.alcoholFree &&
    profile.sensitivity === 'high'
  ) {
    score += 5;

    matchedFactors.push(
      'Alcohol-free'
    );
  }

  const preferences =
    Array.isArray(
      profile.mustHavePreferences
    )
      ? profile.mustHavePreferences.filter(
          (preference) =>
            preference !==
            'no-specific-preference'
        )
      : [];

  if (preferences.length) {
    const intelligenceAttributes =
      intelligence.mustHaveAttributes ||
      {};

    const preferenceAttributes = {
      'fragrance-free':
        product.fragranceFree ??
        intelligenceAttributes[
          'fragrance-free'
        ],

      vegan:
        intelligenceAttributes.vegan,

      'cruelty-free':
        intelligenceAttributes
          .crueltyFree ??
        intelligenceAttributes[
          'cruelty-free'
        ],

      'reef-safe':
        intelligenceAttributes
          .reefSafe ??
        intelligenceAttributes[
          'reef-safe'
        ],
    };

    const unknownRequiredPreferences =
      preferences.filter(
        (preference) =>
          preferenceAttributes[
            preference
          ] !== true &&
          preferenceAttributes[
            preference
          ] !== false
      );

    const failedPreferences =
      preferences.filter(
        (preference) =>
          preferenceAttributes[
            preference
          ] === false
      );

    if (failedPreferences.length) {
      concernsNotMatched.push(
        'required preference conflict'
      );

      potentialConcerns.push(
        `Does not meet required preference: ${failedPreferences[0]}.`
      );
    } else if (
      unknownRequiredPreferences.length
    ) {
      concernsNotMatched.push(
        'required preference unknown'
      );

      potentialConcerns.push(
        `Required preference cannot be verified: ${unknownRequiredPreferences[0]}.`
      );
    } else {
      score += Math.min(
        12,
        preferences.length * 4
      );

      matchedFactors.push(
        `Matches your preferences (${preferences.join(', ')})`
      );
    }
  }

  /*
   * -------------------------------------------------------
   * 9. HIGH SENSITIVITY INGREDIENT ANALYSIS
   * -------------------------------------------------------
   */

  if (
    profile.sensitivity === 'high' &&
    Array.isArray(
      intelligence.ingredientAnalysis
    )
  ) {
    const sensitivityFlags =
      intelligence.ingredientAnalysis
        .filter(
          (entry) =>
            entry?.potentialSensitivityConcern
        )
        .map(
          (entry) => entry.ingredient
        )
        .filter(Boolean);

    if (sensitivityFlags.length) {
      score -= Math.min(
        10,
        sensitivityFlags.length * 3
      );

      concernsNotMatched.push(
        'potential sensitivity ingredients'
      );

      potentialConcerns.push(
        `Contains ingredients flagged for potential sensitivity (${sensitivityFlags
          .slice(0, 2)
          .join(', ')}).`
      );
    }

    const ingredientNames =
      productIngredients
        .map((ingredient) =>
          normalizeTerm(
            typeof ingredient === 'string'
              ? ingredient
              : ingredient?.name ||
                ingredient?.ingredient
          )
        )
        .join(' ');

    const qualitySignals =
      JSON.stringify(
        intelligence.qualityAssessment ||
          {}
      ).toLowerCase();

    const isAggressiveExfoliation =
      [
        'lactic acid',
        'glycolic acid',
        'salicylic acid',
      ].filter((acid) =>
        ingredientNames.includes(
          acid
        )
      ).length >= 2 &&
      /(scrub|physical exfol|chemical exfol|harsh|dry skin|skin barrier)/.test(
        `${ingredientNames} ${qualitySignals}`
      );

    if (
      isAggressiveExfoliation &&
      ['dry', 'sensitive'].includes(
        profile.skinType
      )
    ) {
      score -=
        profile.skinType === 'dry'
          ? 18
          : 24;

      concernsNotMatched.push(
        'aggressive exfoliation suitability'
      );

      potentialConcerns.push(
        'Uses multiple exfoliating signals that may be drying or irritating for your skin type.'
      );
    }
  }

  /*
   * -------------------------------------------------------
   * 10. INGREDIENT BENEFITS
   * -------------------------------------------------------
   */

  const ingredientBenefitScore =
    scoreIngredientBenefits({
      profileConcerns,
      ingredientAnalysis:
        intelligence.ingredientAnalysis,
    });

  score +=
    ingredientBenefitScore.score;

  matchedFactors.push(
    ...ingredientBenefitScore.matchedFactors
  );

  /*
   * -------------------------------------------------------
   * 11. INGREDIENT CONFLICTS
   * -------------------------------------------------------
   */

  if (
    Array.isArray(
      intelligence.ingredientConflicts
    ) &&
    intelligence.ingredientConflicts.length
  ) {
    score -= Math.min(
      18,
      intelligence.ingredientConflicts
        .length * 6
    );

    concernsNotMatched.push(
      'ingredient conflict'
    );

    potentialConcerns.push(
      `Potential ingredient conflict noted: ${intelligence.ingredientConflicts[0]}.`
    );
  }

  /*
   * -------------------------------------------------------
   * 12. INTELLIGENCE-BASED AVOIDANCE SIGNALS
   * -------------------------------------------------------
   */

  const avoidanceSignalScore =
    scoreAvoidanceSignals({
      avoidanceSignals:
        intelligence.avoidanceSignals,
      avoidanceTerms,
    });

  if (
    avoidanceSignalScore.conflict
  ) {
    score -= 16;

    concernsNotMatched.push(
      ...avoidanceSignalScore.concernsNotMatched
    );

    if (
      avoidanceSignalScore.explanation
    ) {
      potentialConcerns.push(
        avoidanceSignalScore.explanation
      );
    }
  }

  /*
   * -------------------------------------------------------
   * 13. HYDRATION + OIL CONTROL
   * -------------------------------------------------------
   */

  const hydrationOilScore =
    scoreHydrationAndOilControl({
      skinProfile: profile,
      intelligence,
    });

  score += hydrationOilScore.score;

  matchedFactors.push(
    ...hydrationOilScore.matchedFactors
  );

  /*
   * -------------------------------------------------------
   * 14. PRODUCT QUALITY
   * -------------------------------------------------------
   */

  const qualityScore =
    normalizeNumber(
      product.qualityScore,
      0
    );

  if (qualityScore > 0) {
    score += Math.round(
      (qualityScore / 10) * 6
    );
  }

  /*
   * -------------------------------------------------------
   * 15. CURRENT CATEGORY
   * -------------------------------------------------------
   */

  if (
    currentCategory &&
    product.category &&
    currentCategory.toString() ===
      product.category.toString()
  ) {
    score += 4;

    matchedFactors.push(
      'Matches your current product category'
    );
  } else if (currentCategory) {
    score -= 3;

    concernsNotMatched.push(
      'category match'
    );
  }

  /*
   * -------------------------------------------------------
   * 16. BUDGET
   *
   * IMPORTANT:
   * Budget is intentionally NOT used as a core
   * recommendation score anymore.
   *
   * The Products page should filter by the user's
   * selected budget.
   *
   * We still keep offerPrice in this function because
   * other recommendation presentation logic may use it.
   * -------------------------------------------------------
   */

  if (
    currentOfferPrice > 0 &&
    profile.budget?.max &&
    currentOfferPrice <=
      normalizeNumber(
        profile.budget.max,
        5000
      )
  ) {
    matchedFactors.push(
      'Within your saved budget'
    );
  }

  /*
   * -------------------------------------------------------
   * 17. EXPLICIT AVOIDED INGREDIENTS
   * -------------------------------------------------------
   */

  if (avoidanceMatches.length) {
    score -= 18;

    concernsNotMatched.push(
      'avoided ingredient conflict'
    );

    potentialConcerns.push(
      `Contains an ingredient you asked to avoid (${avoidanceMatches[0]}).`
    );
  }

  /*
   * -------------------------------------------------------
   * 18. FINAL SAFETY / COMPATIBILITY CAPS
   * -------------------------------------------------------
   */

  let finalScore =
    clampScore(score);

  // Confirmed allergy conflict is extremely strong.
  if (allergyMatches.length) {
    finalScore = Math.min(
      finalScore,
      12
    );

    concernsNotMatched.push(
      'confirmed allergy conflict'
    );

    potentialConcerns.unshift(
      `Contains an ingredient that matches one of your listed allergies (${allergyMatches[0]}).`
    );
  } else if (
    avoidanceMatches.length
  ) {
    finalScore = Math.min(
      finalScore,
      30
    );
  } else if (
    avoidanceSignalScore.conflict
  ) {
    finalScore = Math.min(
      finalScore,
      35
    );
  }

  if (
    skinTypeCompatibility.status ===
    'incompatible'
  ) {
    finalScore = Math.min(
      finalScore,
      25
    );
  }

  /*
   * -------------------------------------------------------
   * 19. FINAL RESPONSE
   * -------------------------------------------------------
   */

  const uniqueMatchedFactors =
    uniqueStrings(
      matchedFactors
    );

  const uniqueConcernsMatched =
    uniqueStrings(
      concernsMatched
    );

  const uniqueConcernsNotMatched =
    uniqueStrings(
      concernsNotMatched
    );

  return {
    score: finalScore,

    matchedFactors:
      uniqueMatchedFactors,

    concernsMatched:
      uniqueConcernsMatched,

    concernsNotMatched:
      uniqueConcernsNotMatched,

    explanation:
      buildScoreExplanation({
        matchedFactors:
          uniqueMatchedFactors,

        potentialConcerns:
          uniqueStrings(
            potentialConcerns
          ),

        qualityScore,
      }),
  };
};

export default scoreProductCompatibility;