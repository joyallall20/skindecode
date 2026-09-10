import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanProductPageContent } from '../src/services/productContentCleaner.js';

const AMAZON_STYLE_MARKDOWN = `
# Keyboard shortcut shift+alt+opt+D
# Adding to Cart...
# Added to Cart
## Item is in your Cart
##### One-time purchase $18.96 FREE delivery Ships from Amazon
# Choose how often it's delivered
##### [2 weeks](https://www.amazon.com/x)
##### [1 month](https://www.amazon.com/x)

# CeraVe Moisturizing Cream, Face & Body Moisturizer for Dry Skin, 19oz
Visit the CeraVe Store
Brand: CeraVe

## About this item
- Daily face and body moisturizer for dry skin
- Fragrance free, non-comedogenic
- Developed with dermatologists

# Product specifications
| Item Volume | 19 Fluid Ounces |
| Unit Count | 19 Ounce |
| Item Weight | 1.2 pounds |

# Materials & Care
| Active Ingredients | Hyaluronic Acid |
| Special Ingredients | Ceramides, Hyaluronic Acid |
| Material Features | Fragrance Free, Hypoallergenic |

## Frequently bought together
- CeraVe Hydrating Cleanser
- CeraVe PM Facial Moisturizing Lotion

## Similar items that may deliver to you quickly
- Neutrogena Hydro Boost

## Sponsored
Buy this other cream now

## Important information
#### Ingredients
Water, Glycerin, Cetearyl Alcohol, Caprylic/Capric Triglyceride, Cetyl Alcohol, Petrolatum, Ceramide NP
#### Directions
Apply evenly to face and body.

## Product Description
A rich moisturizing cream with ceramides and hyaluronic acid.

## From the manufacturer
Rich moisturizing cream for dry skin. Size: 19 oz. Quantity: 1.

## Product details
ASIN: B00TTD9BRC
UPC: 3606000536445
Manufacturer: CeraVe

## Customer reviews
### Customers say
Customers love the texture.
##### ⭐⭐⭐⭐⭐ — Excellent Stuff. At the Right Price.
This cream changed my life. Ingredients feel amazing.

### Top reviews from the United States
##### FANTASTIC RESULTS
Would buy again.

# Customer questions & answers
Asked by Jane: Does it have fragrance?
Answer: No.

## Feedback
Was this page helpful?

# s.amazon-adsystem.com is blocked
`;

test('keeps product facts from later Amazon sections', () => {
  const result = cleanProductPageContent(AMAZON_STYLE_MARKDOWN);

  assert.match(result.content, /CeraVe Moisturizing Cream/);
  assert.match(result.content, /About this item/i);
  assert.match(result.content, /Ceramide NP/);
  assert.match(result.content, /Ceramides, Hyaluronic Acid/);
  assert.ok(result.filteredLength < result.sourceLength);
});

test('removes reviews, Q&A, recommendations, and navigation', () => {
  const result = cleanProductPageContent(AMAZON_STYLE_MARKDOWN);

  assert.doesNotMatch(result.content, /Customer reviews/i);
  assert.doesNotMatch(result.content, /Customers say/i);
  assert.doesNotMatch(result.content, /FANTASTIC RESULTS/);
  assert.doesNotMatch(result.content, /Excellent Stuff/);
  assert.doesNotMatch(result.content, /Customer questions/i);
  assert.doesNotMatch(result.content, /Asked by Jane/);
  assert.doesNotMatch(result.content, /Frequently bought together/i);
  assert.doesNotMatch(result.content, /Hydrating Cleanser/);
  assert.doesNotMatch(result.content, /Similar items/i);
  assert.doesNotMatch(result.content, /Neutrogena/);
  assert.doesNotMatch(result.content, /Sponsored/i);
  assert.doesNotMatch(result.content, /Adding to Cart/i);
  assert.doesNotMatch(result.content, /Choose how often/i);
  assert.doesNotMatch(result.content, /amazon-adsystem/i);
  assert.doesNotMatch(result.content, /Was this page helpful/);
});

test('drops unidentified and marketing sections that are not needed for extraction', () => {
  const markdown = `# Mystery widget\nCustom lab batch code: ABC-99\n\n## Customer reviews\nTerrible\n`;
  const result = cleanProductPageContent(markdown);
  assert.doesNotMatch(result.content, /ABC-99/);
  assert.doesNotMatch(result.content, /Terrible/);
});

test('keeps focused extraction content well under the previous 14k Groq payload', () => {
  const result = cleanProductPageContent(AMAZON_STYLE_MARKDOWN);
  assert.ok(result.filteredLength < 4000);
  assert.doesNotMatch(result.content, /https?:\/\//);
});
