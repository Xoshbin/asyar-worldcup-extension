import { describe, it, expect } from 'vitest';
import manifest from '../manifest.json';

// Valid preference `type` values accepted by the launcher's Rust manifest
// parser (PreferenceType enum, serde camelCase) in
// asyar-launcher/src-tauri/src/extensions/mod.rs. A value outside this set
// makes serde fail to deserialize the WHOLE manifest, so the launcher
// silently skips the extension at discovery time. "text" is NOT valid — a
// text field is "textfield".
const VALID_PREFERENCE_TYPES = new Set([
  'textfield', 'password', 'number', 'checkbox',
  'dropdown', 'appPicker', 'file', 'directory',
]);

describe('manifest preferences', () => {
  it('declares only preference types the launcher can deserialize', () => {
    const prefs = (manifest.preferences ?? []) as Array<{ name: string; type: string }>;
    const invalid = prefs.filter((p) => !VALID_PREFERENCE_TYPES.has(p.type));
    expect(invalid.map((p) => `${p.name}:${p.type}`)).toEqual([]);
  });
});
