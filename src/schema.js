// src/schema.js

// This file serves as a runtime module entry point for the schema types.
// It allows TypeScript's `moduleResolution: "bundler"` to correctly resolve
// imports from './schema' by providing a JavaScript file that bundlers can find.
// The actual types come from schema.d.ts through TypeScript's declaration merging.

// Export placeholder objects that match the interface names in schema.d.ts
// These will be augmented with proper types from the declaration file
export const paths = {};
export const components = {};
export const webhooks = {};
export const $defs = {};
export const operations = {};