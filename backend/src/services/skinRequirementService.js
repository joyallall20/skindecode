

const normalize = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, '-')
    .replace(/\s+/g, ' ');

const normalizeKey = (value) =>
  normalize(value)
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-');

const unique = (values = []) => [
  ...new Set(
    values
      .map((value) => normalizeKey(value))
      .filter(Boolean)
  ),
];

const clamp01 = (value) =>
  Math.max(0, Math.min(1, Number(value) || 0));

const hasValue = (value) => {
  const normalized = normalize(value);
  return Boolean(normalized) && normalized !== 'unknown';
};

const includesAny = (values, candidates) => {
  const set = new Set(values);
  return candidates.some((candidate) => set.has(candidate));
};

/**
 * Maps questionnaire answers into deterministic requirements.
 *
 * The output intentionally contains:
 *
 * hardConstraints:
 *   Things that can make a product ineligible.
 *
 * needs:
 *   Continuous user needs from 0-1.
 *
 * priorities:
 *   Relative importance of soft dimensions.
 *
 * concerns:
 *   Explicit user concerns.
 */
export const deriveSkinRequirements = (skinProfile = {}) => {
  const skinType = normalizeKey(skinProfile.skinType || 'unknown');
  const sensitivity = normalizeKey(skinProfile.sensitivity || 'unknown');

  const morningSkinFeel = normalizeKey(
    skinProfile.morningSkinFeel || 'unknown'
  );

  const afterMoisturizerFeel = normalizeKey(
    skinProfile.afterMoisturizerFeel || 'unknown'
  );

  const responseToNewProducts = normalizeKey(
    skinProfile.responseToNewProducts || 'unknown'
  );

  const sunscreenHabit = normalizeKey(
    skinProfile.sunscreenHabit || 'unknown'
  );

  const primaryGoal = normalizeKey(
    skinProfile.primaryGoal || 'unknown'
  );

  const concerns = unique(skinProfile.concerns || []);

  const avoidancePreferences = unique(
    skinProfile.avoidancePreferences || []
  );

  const mustHavePreferences = unique(
    skinProfile.mustHavePreferences || []
  ).filter(
    (value) =>
      value !== 'no-specific-preference' &&
      value !== 'none' &&
      value !== 'nothing'
  );

  const allergies = unique(skinProfile.allergies || []);

  const avoidedIngredients = Array.isArray(
    skinProfile.avoidedIngredients
  )
    ? skinProfile.avoidedIngredients
        .map((ingredient) => ({
          id: ingredient?._id
            ? String(ingredient._id)
            : ingredient?.id
              ? String(ingredient.id)
              : null,
          name: normalize(ingredient?.name || ingredient),
          aliases: Array.isArray(ingredient?.aliases)
            ? ingredient.aliases.map(normalize).filter(Boolean)
            : [],
        }))
        .filter(
          (ingredient) =>
            ingredient.name ||
            ingredient.aliases.length ||
            ingredient.id
        )
    : [];

  /*
   * ------------------------------------------------------------
   * BASE NEEDS
   * ------------------------------------------------------------
   */

  const needs = {
    hydration: 0,
    oilControl: 0,
    barrierSupport: 0,
    irritationControl: 0,
    lightweightFormulation: 0,
    richFormulation: 0,
    sunscreenProtection: 0,
    uvaProtection: 0,
    uvbProtection: 0,
    photostability: 0,
    filmIntegrity: 0,
  };

  /*
   * ------------------------------------------------------------
   * SKIN TYPE
   * ------------------------------------------------------------
   */

  switch (skinType) {
    case 'oily':
      needs.oilControl = 0.85;
      needs.lightweightFormulation = 0.75;
      needs.hydration = 0.35;
      break;

    case 'very-oily':
      needs.oilControl = 1;
      needs.lightweightFormulation = 0.9;
      needs.hydration = 0.3;
      break;

    case 'dry':
      needs.hydration = 0.9;
      needs.barrierSupport = 0.85;
      needs.richFormulation = 0.65;
      needs.oilControl = 0.15;
      break;

    case 'dehydrated':
      needs.hydration = 1;
      needs.barrierSupport = 0.8;
      break;

    case 'combination':
      needs.oilControl = 0.65;
      needs.hydration = 0.65;
      needs.lightweightFormulation = 0.65;
      break;

    case 'normal':
      needs.hydration = 0.4;
      needs.oilControl = 0.35;
      break;

    case 'sensitive':
      needs.irritationControl = 0.95;
      needs.barrierSupport = 0.85;
      break;

    default:
      break;
  }

  /*
   * ------------------------------------------------------------
   * SENSITIVITY
   * ------------------------------------------------------------
   */

  switch (sensitivity) {
    case 'low':
      needs.irritationControl = Math.max(
        needs.irritationControl,
        0.2
      );
      break;

    case 'medium':
      needs.irritationControl = Math.max(
        needs.irritationControl,
        0.6
      );
      needs.barrierSupport = Math.max(
        needs.barrierSupport,
        0.45
      );
      break;

    case 'high':
    case 'very-high':
      needs.irritationControl = 1;
      needs.barrierSupport = Math.max(
        needs.barrierSupport,
        0.9
      );
      break;

    default:
      break;
  }

  /*
   * ------------------------------------------------------------
   * MORNING SKIN FEEL
   * ------------------------------------------------------------
   */

  if (
    includesAny(
      [morningSkinFeel],
      ['oily', 'very-oily', 'greasy', 'shiny']
    )
  ) {
    needs.oilControl = Math.max(
      needs.oilControl,
      0.8
    );

    needs.lightweightFormulation = Math.max(
      needs.lightweightFormulation,
      0.75
    );
  }

  if (
    includesAny(
      [morningSkinFeel],
      ['dry', 'tight', 'dehydrated']
    )
  ) {
    needs.hydration = Math.max(
      needs.hydration,
      0.8
    );

    needs.barrierSupport = Math.max(
      needs.barrierSupport,
      0.7
    );
  }

  /*
   * ------------------------------------------------------------
   * AFTER MOISTURIZER FEEL
   * ------------------------------------------------------------
   */

  if (
    includesAny(
      [afterMoisturizerFeel],
      ['greasy', 'heavy', 'too-oily']
    )
  ) {
    needs.lightweightFormulation = Math.max(
      needs.lightweightFormulation,
      0.8
    );

    needs.oilControl = Math.max(
      needs.oilControl,
      0.65
    );
  }

  if (
    includesAny(
      [afterMoisturizerFeel],
      ['still-dry', 'dry', 'tight', 'not-enough']
    )
  ) {
    needs.hydration = Math.max(
      needs.hydration,
      0.8
    );

    needs.barrierSupport = Math.max(
      needs.barrierSupport,
      0.7
    );
  }

  /*
   * ------------------------------------------------------------
   * RESPONSE TO NEW PRODUCTS
   * ------------------------------------------------------------
   */

  if (
    includesAny(
      [responseToNewProducts],
      [
        'often-irritated',
        'easily-irritated',
        'irritated',
        'reactive',
        'very-sensitive',
      ]
    )
  ) {
    needs.irritationControl = 1;
    needs.barrierSupport = Math.max(
      needs.barrierSupport,
      0.85
    );
  }

  if (
    includesAny(
      [responseToNewProducts],
      [
        'sometimes-irritated',
        'occasionally-irritated',
        'sometimes-reactive',
      ]
    )
  ) {
    needs.irritationControl = Math.max(
      needs.irritationControl,
      0.7
    );
  }

  /*
   * ------------------------------------------------------------
   * CONCERNS
   * ------------------------------------------------------------
   */

  if (
    includesAny(concerns, [
      'dryness',
      'dehydration',
      'dry-skin',
    ])
  ) {
    needs.hydration = Math.max(
      needs.hydration,
      0.9
    );
  }

  if (
    includesAny(concerns, [
      'acne',
      'breakouts',
      'excess-oil',
      'oiliness',
      'large-pores',
    ])
  ) {
    needs.oilControl = Math.max(
      needs.oilControl,
      0.75
    );
  }

  if (
    includesAny(concerns, [
      'redness',
      'irritation',
      'sensitivity',
      'reactivity',
    ])
  ) {
    needs.irritationControl = Math.max(
      needs.irritationControl,
      0.9
    );

    needs.barrierSupport = Math.max(
      needs.barrierSupport,
      0.75
    );
  }

  if (
    includesAny(concerns, [
      'barrier-damage',
      'damaged-barrier',
      'barrier',
    ])
  ) {
    needs.barrierSupport = Math.max(
      needs.barrierSupport,
      1
    );
  }

  /*
   * ------------------------------------------------------------
   * SUNSCREEN NEED
   * ------------------------------------------------------------
   */

  const sunscreenCategorySignals = [
    'sunscreen',
    'sun-screen',
    'sun screen',
    'spf',
    'uv protection',
  ];

  const sunscreenRelevant =
    hasValue(sunscreenHabit) ||
    includesAny(concerns, [
      'uv-protection',
      'sun-damage',
      'tanning',
      'hyperpigmentation',
      'pigmentation',
      'dark-spots',
    ]);

  if (sunscreenRelevant) {
    needs.sunscreenProtection = 0.9;
  }

  if (
    includesAny(
      [sunscreenHabit],
      [
        'daily',
        'every-day',
        'everyday',
        'regularly',
        'always',
      ]
    )
  ) {
    needs.sunscreenProtection = 1;
    needs.uvaProtection = 0.9;
    needs.uvbProtection = 0.9;
    needs.photostability = 0.8;
    needs.filmIntegrity = 0.8;
  }

  /*
   * Pigmentation / tanning makes UVA especially relevant.
   *
   * This does NOT claim that UVA is the only cause.
   * It simply makes UVA protection a higher matching priority.
   */

  if (
    includesAny(concerns, [
      'pigmentation',
      'hyperpigmentation',
      'dark-spots',
      'tanning',
      'sun-damage',
    ])
  ) {
    needs.uvaProtection = Math.max(
      needs.uvaProtection,
      0.9
    );
  }

  /*
   * ------------------------------------------------------------
   * PRIMARY GOAL
   * ------------------------------------------------------------
   */

  const goalNeeds = {
    hydration: {
      hydration: 1,
      barrierSupport: 0.7,
    },

    'clearer-skin': {
      oilControl: 0.7,
      irritationControl: 0.5,
    },

    'brighter-even': {
      sunscreenProtection: 0.85,
      uvaProtection: 0.85,
    },

    'less-oiliness': {
      oilControl: 1,
      lightweightFormulation: 0.8,
    },

    'smoother-texture': {
      hydration: 0.45,
    },

    'anti-aging': {
      sunscreenProtection: 0.8,
      uvaProtection: 0.8,
      barrierSupport: 0.45,
    },

    'healthier-skin': {
      barrierSupport: 0.75,
      irritationControl: 0.65,
      hydration: 0.65,
    },
  };

  const goalRequirement = goalNeeds[primaryGoal];

  if (goalRequirement) {
    Object.entries(goalRequirement).forEach(
      ([key, value]) => {
        needs[key] = Math.max(
          needs[key] || 0,
          clamp01(value)
        );
      }
    );
  }

  /*
   * ------------------------------------------------------------
   * PRIORITIES
   * ------------------------------------------------------------
   *
   * These are weights, not scores.
   *
   * A dimension with no meaningful user need receives little/no
   * influence.
   */

  const priorities = {
    skinType: 0.2,
    sensitivity: 0.2,
    concerns: 0.2,
    hydration: needs.hydration,
    oilControl: needs.oilControl,
    barrierSupport: needs.barrierSupport,
    irritationControl: needs.irritationControl,
    formulation: Math.max(
      needs.lightweightFormulation,
      needs.richFormulation
    ),
    sunscreen: Math.max(
      needs.sunscreenProtection,
      needs.uvaProtection,
      needs.uvbProtection,
      needs.photostability,
      needs.filmIntegrity
    ),
  };

  /*
   * Explicit skin type should matter more than inferred skin feel.
   */

  if (hasValue(skinType)) {
    priorities.skinType = 0.9;
  }

  if (hasValue(sensitivity)) {
    priorities.sensitivity = 0.95;
  }

  /*
   * Explicit concerns are more important than generic inferred
   * preferences.
   */

  if (concerns.length) {
    priorities.concerns = Math.min(
      1,
      0.5 + concerns.length * 0.15
    );
  }

  /*
   * Explicit must-haves and avoidances are hard constraints.
   */

  const hardConstraints = {
    allergies,
    avoidedIngredients,
    mustHavePreferences,
    avoidancePreferences,
  };

  /*
   * ------------------------------------------------------------
   * REQUIREMENT SUMMARY
   * ------------------------------------------------------------
   */

  return {
    version: 1,

    source: 'SkinProfile',

    skinType,
    sensitivity,
    morningSkinFeel,
    afterMoisturizerFeel,
    responseToNewProducts,
    sunscreenHabit,
    primaryGoal,

    concerns,

    needs,

    priorities,

    hardConstraints,

    flags: {
      sunscreenRelevant,
      explicitSkinType: hasValue(skinType),
      explicitSensitivity: hasValue(sensitivity),
      explicitConcerns: concerns.length > 0,
      explicitAvoidances:
        allergies.length > 0 ||
        avoidedIngredients.length > 0 ||
        avoidancePreferences.length > 0,
      explicitMustHaves:
        mustHavePreferences.length > 0,
    },

    categorySignals: sunscreenCategorySignals,
  };
};

export default deriveSkinRequirements;

