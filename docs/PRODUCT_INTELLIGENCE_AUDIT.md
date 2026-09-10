# Product Intelligence × Skin Profile Audit Report

**Date:** 2026-09-06  
**Intelligence Version:** 1.0.0  
**Prompt Version:** 1.0.0  
**Knowledge Base Version:** 0.0.0 (not yet seeded)

---

## 1. Executive Summary

Product intelligence generation (`generateProductIntelligence`) and user-product matching (`scoreProductCompatibility`) are **separate layers**:

| Layer | Purpose | Uses SkinProfile? |
|-------|---------|-------------------|
| **Product Intelligence** | Analyze product formulation from brand-disclosed data | **No** |
| **User-Product Matching** | Score product fit for a specific skin profile | **Yes** |

Publishing no longer triggers intelligence generation. Intelligence is an explicit admin action via `POST /api/products/:id/generate-intelligence`.

---

## 2. SkinProfile Fields

| Field | Type | Values |
|-------|------|--------|
| skinType | enum | oily, dry, combination, normal, unknown |
| sensitivity | enum | low, medium, high, unknown |
| morningSkinFeel | enum | dry, balanced, slightly-oily, very-oily, combination-feel, unknown |
| afterMoisturizerFeel | string | free text, default unknown |
| responseToNewProducts | enum | no-reaction, sometimes-irritated, often-irritated, very-easily-irritated, unknown |
| sunscreenHabit | enum | every-day, sometimes, rarely-never, unknown |
| ageRange | enum | under-18, 18-24, 25-34, 35-44, 45-plus, unknown |
| currentProducts | enum[] | cleanser, moisturizer, sunscreen, serum, exfoliant, treatment, eye-cream, none |
| primaryGoal | enum | clearer-skin, brighter-even, hydration, smoother-texture, less-oiliness, anti-aging, healthier-skin, unknown |
| concerns | enum[] | 14 concern values (see SkinProfile model) |
| allergies | string[] | free text |
| avoidedIngredients | ObjectId[] → Ingredient | populated names/aliases |
| mustHavePreferences | enum[] | cruelty-free, vegan, fragrance-free, reef-safe, no-specific-preference |
| budget | { min, max } | numeric range |
| preferredProductCategories | ObjectId[] → Category | filters product query |
| questionnaireCompleted | boolean | not used in scoring |
| onboardingAnswers | mixed | avoidedIngredients used in matching |

---

## 3. Product Fields Used in Intelligence Generation

Fields sent to `generateProductIntelligence()` via `buildProductContext()`:

| Field | Sent to AI | Notes |
|-------|------------|-------|
| name | ✅ | Required for context |
| brand | ✅ | String name |
| category | ✅ | String name |
| description | ✅ | |
| ingredients | ✅ | Array of names |
| keyIngredients | ✅ | Array of names |
| skinTypes | ✅ | Brand-listed |
| concerns | ✅ | Brand-listed |
| fragranceFree | ✅ | tri-state |
| alcoholFree | ✅ | tri-state |
| essentialOilFree | ✅ | tri-state |
| pregnancyFriendly | ❌ | **Not in prompt** — gap |
| price | ❌ | Not used |
| retailer | ❌ | Not used |
| images | ❌ | Not used |
| productIntelligence.mustHaveAttributes | ✅ | If pre-existing |

---

## 4. Field Usage Table

| Field | Exists | Sent to AI | Used in Matching | Used in Scoring | Tested |
|-------|--------|------------|------------------|-----------------|--------|
| skinType | ✅ | ❌ | ✅ | ✅ | ✅ 100% enum |
| sensitivity | ✅ | ❌ | ✅ | ✅ | ✅ 100% enum |
| morningSkinFeel | ✅ | ❌ | ✅ | ✅ | ✅ 100% enum |
| afterMoisturizerFeel | ✅ | ❌ | ❌ | ❌ | ❌ |
| responseToNewProducts | ✅ | ❌ | ✅ | ✅ | ✅ 100% enum |
| sunscreenHabit | ✅ | ❌ | ✅ | ✅ | ✅ 100% enum |
| ageRange | ✅ | ❌ | ❌ | ❌ | ✅ documented limitation |
| currentProducts | ✅ | ❌ | ✅ | ✅ | ✅ 100% enum |
| primaryGoal | ✅ | ❌ | ✅ | ✅ | ✅ 100% enum |
| concerns | ✅ | ❌ | ✅ | ✅ | ✅ 100% individual |
| allergies | ✅ | ❌ | ✅ hard exclude | ✅ | ✅ safety cases |
| avoidedIngredients | ✅ | ❌ | ✅ | ✅ | ✅ safety cases |
| mustHavePreferences | ✅ | ❌ | ✅ | ✅ | ✅ 100% enum |
| budget | ✅ | ❌ | ✅ filter/score | ✅ | ⚠️ partial |
| preferredProductCategories | ✅ | ❌ | ✅ query filter | ❌ | ⚠️ partial |
| questionnaireCompleted | ✅ | ❌ | ❌ | ❌ | ❌ |
| onboardingAnswers | ✅ | ❌ | ✅ avoidance | ✅ | ⚠️ partial |

---

## 5. Intelligence Output Schema

Stored on `Product.productIntelligence`:

```
skinTypeCompatibility: { oily, dry, combination, normal, sensitive } → 0–1
sensitivitySuitability: { low, medium, high } → 0–1
concernCompatibility: { [concernKey]: 0–1 }
ingredientAnalysis: [{ ingredient, benefits, relevantConcerns, potentialSensitivityConcern, explanation, evidenceLevel }]
ingredientConflicts: string[]
avoidanceSignals: { [key]: string }
mustHaveAttributes: { [key]: boolean }
hydrationProfile: string
oilControlProfile: string
qualityAssessment: { formulationSignals, transparencyNotes, limitations, ratingBasis }
evidenceConfidence: 0–1
explanation: string
```

Versioning stored in `Product.intelligenceMetadata`: generatedAt, intelligenceVersion, promptVersion, knowledgeBaseVersion, provider, model.

---

## 6. Combination Coverage Strategy

Implemented in `backend/src/data/skinProfileTestMatrix.js`:

| Category | Count | Coverage |
|----------|-------|----------|
| Single-dimension | ~70 profiles | 100% of every enum value |
| Pairwise | 16 combinations | Clinically relevant pairs |
| Safety-critical | 12 scenarios | 100% of defined safety cases |
| Boundary | 5 cases | empty, all-unknown, all-selected |
| Product fixtures | 4 products | representative formulations |

**Not claimed:** exhaustive cross-product of all dimensions (mathematically intractable).

Run audit: `node backend/scripts/run-intelligence-audit.js`

API: `POST /api/admin/intelligence/run-matching-audit`

---

## 7. Safety-Critical Test Cases

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| safety-oily-high-sensitivity | oily + high sensitivity | Irritation risk awareness |
| safety-dry-high-sensitivity | dry + high sensitivity | Gentle hydration preference |
| safety-acne-redness | acne + redness | Conflicting needs |
| safety-acne-dryness | acne + dryness | Balance oil control + hydration |
| safety-excess-oil-dehydration | oily + dehydration | Distinguish oil vs water loss |
| safety-multiple-concerns | 5+ concerns | No overconfidence |
| safety-allergy-fragrance | fragrance allergy | Hard exclusion |
| safety-avoided-retinol | avoided retinol | Penalty/exclusion |
| safety-fragrance-free-pref | fragrance-free pref | Attribute check |
| safety-vegan-pref | vegan pref | mustHaveAttributes.vegan |
| safety-under18-active | under-18 + acne | **ageRange not scored** — limitation |
| safety-very-easily-irritated | high reactivity | Bonus for free-from products |

---

## 8. Missing Connections & Known Limitations

1. **pregnancyFriendly** exists on Product but is NOT sent to intelligence prompt
2. **ageRange** stored in profile snapshots but NOT used in `scoreProductCompatibility`
3. **afterMoisturizerFeel** has no effect anywhere
4. **preferredProductCategories** filters catalog but not per-product scoring
5. Product intelligence is **profile-agnostic** — same output regardless of user
6. No research-backed ingredient knowledge base yet (knowledgeBaseVersion: 0.0.0)
7. Gemini required for intelligence generation; matching audit runs without LLM

---

## 9. Recommended Architecture (Research KB Ready)

```
Ingredient (canonical)
  → Evidence (source, strength, date)
    → Effect (benefit/concern)
      → Context (skin type, sensitivity)
        → Product Intelligence (injected into prompt, not hardcoded claims)
          → User-Product Matching (uses intelligence + profile)
```

**Principles:**
- Research claims traceable to Evidence records
- AI must cite evidenceLevel, not invent clinical validation
- knowledgeBaseVersion bumps trigger intelligence regeneration
- Prompt receives structured ingredient facts, not prose claims

---

## 10. New API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/products/:id/generate-intelligence` | Generate intelligence from saved product |
| GET | `/api/products/:id/intelligence-input` | Preview intelligence input |
| GET | `/api/product-imports/:id/intelligence-input` | Preview from import extracted data |
| GET | `/api/admin/intelligence/audit` | Full audit report |
| GET | `/api/admin/intelligence/test-matrix` | Machine-readable test matrix |
| POST | `/api/admin/intelligence/run-matching-audit` | Run deterministic matching tests |
| POST | `/api/admin/intelligence/test` | Test product + profile |

---

## 11. Admin Workflow (Implemented)

```
EXTRACT (URL only, no intelligence)
    ↓
REVIEW & EDIT (all product fields)
    ↓
SAVE PRODUCT DATA (import extractedData)
    ↓
SAVE TO CATALOG (creates draft product, isActive: false)
    ↓
GENERATE INTELLIGENCE (explicit, uses saved product data)
    ↓
REVIEW INTELLIGENCE
    ↓
PUBLISH (requires intelligence, sets isActive: true)
```

**Principle:** EXTRACT ≠ INTELLIGENCE ≠ PUBLISH

---

## 12. Measurable Coverage Summary

- ✅ 100% single-dimension enum value coverage
- ✅ 100% safety-critical scenario coverage (12 cases)
- ✅ Defined pairwise coverage (16 combinations)
- ✅ Boundary/unknown-state coverage
- ✅ 4 representative product fixtures × full profile matrix
- ⚠️ Research/evidence validation: not yet implemented (KB v0.0.0)
- ⚠️ LLM intelligence generation: requires manual/Gemini testing per product
