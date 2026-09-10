#!/usr/bin/env node
/**
 * Run deterministic profile × product matching audit (no LLM calls).
 * Usage: node scripts/run-intelligence-audit.js
 */
import { runProfileMatchingHarness } from '../src/services/productIntelligenceTestHarness.js';

const result = runProfileMatchingHarness();

console.log('=== Product Intelligence Matching Audit ===\n');
console.log(`Total test cases: ${result.summary.total}`);
console.log(`Passed: ${result.summary.passed}`);
console.log(`Failed: ${result.summary.failed}`);
console.log(`Warnings: ${result.summary.warnings}`);
console.log('\nCoverage:');
console.log(JSON.stringify(result.summary.coverage, null, 2));
console.log('\nAudit info:');
console.log(JSON.stringify(result.audit, null, 2));

if (result.failed > 0) {
  console.log('\nFailed cases:');
  result.results.filter((r) => !r.pass).slice(0, 10).forEach((r) => {
    console.log(`  - ${r.testCaseId}: ${r.error || 'no explanation'}`);
  });
  process.exit(1);
}

console.log('\nAll matching audit cases passed.');
process.exit(0);
