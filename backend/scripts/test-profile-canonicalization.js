/**
 * Tests for profile canonicalization — array order should not affect hash.
 * Run: node scripts/test-profile-canonicalization.js
 */
import { computeCanonicalProfileHash, buildCanonicalProfile } from '../src/services/profileCanonicalizationService.js';

let passed = 0;
let failed = 0;

const assert = (label, condition) => {
  if (condition) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.error(`  ✗ ${label}`); }
};

console.log('=== Profile Canonicalization Tests ===\n');

const profileA = {
  skinType: 'oily',
  sensitivity: 'high',
  concerns: ['acne', 'redness'],
  mustHavePreferences: ['fragrance-free'],
  allergies: ['fragrance'],
  userId: 'user-123',
};

const profileB = {
  skinType: 'oily',
  sensitivity: 'high',
  concerns: ['redness', 'acne'],
  mustHavePreferences: ['fragrance-free'],
  allergies: ['fragrance'],
  userId: 'user-456',
};

const hashA = computeCanonicalProfileHash(profileA);
const hashB = computeCanonicalProfileHash(profileB);

assert('Same hash for reordered concerns', hashA === hashB);
assert('Hash excludes userId', hashA === computeCanonicalProfileHash({ ...profileA, userId: 'different' }));
assert('Different skinType produces different hash', hashA !== computeCanonicalProfileHash({ ...profileA, skinType: 'dry' }));

const canonical = buildCanonicalProfile(profileA);
assert('Concerns are sorted', canonical.concerns[0] === 'acne' && canonical.concerns[1] === 'redness');
assert('No userId in canonical', !canonical.userId);
assert('Budget included in canonical profile', canonical.budget?.max === 5000 || Boolean(canonical.budget));

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
