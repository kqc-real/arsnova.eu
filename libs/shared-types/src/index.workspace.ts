/**
 * Workspace entry for local app builds.
 *
 * Uses extensionless re-exports so Angular/Webpack can resolve the source tree
 * directly without requiring the package dist output first.
 */
export * from './schemas';
export * from './qa-joinable';
export * from './qa-redaction';
export * from './confidence';
export * from './session-export-insights';
export * from './word-cloud-normalization';
export * from './word-cloud-analysis-text';
export * from './word-cloud-semantic';
export * from './qa-summary-rank';
export * from './qa-summary-visibility';
export * from './qa-summary-v2';
export * from './product-feedback';
export * from './host-pairing';
export * from './learning-objectives';
export * from './learning-objective-derivation';
export * from './learning-objective-derivation-capability';
export * from './moderation-compass-rules';
export * from './moderation-prompt-context';
export * from './moderation-prompt-context-fixtures';
export * from './open-weight-llm';
export * from './kindergarten-nicknames';
export * from './legacy-kindergarten-nicknames';
// Display rewriter stays off this barrel so the Angular initial bundle
// does not pull it into every @arsnova/shared-types import.
