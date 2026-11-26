// Auto-generated. Per-entity form-enhancements config for "Erfindungsmeldungen".
// Written by the backend form polish (app/services/form_polish.py) from the
// generator's manifest; scripts/parse-formulas.mjs expands the formula strings.
// Schema: see ./types.ts.

import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: ["titel", {"row": ["melder_vorname", "melder_nachname"]}, "melder_email", "erfindungsart", "loesung", "einreichende_person", "melder_telefon", "abteilung", "technisches_gebiet", {"row": ["fertigstellung", "meldedatum"], "cols": "1fr 1fr"}, "status", "betriebliche_mittel", "mittel_beschreibung", "problem", "vorteile", "miterfinder"],
  defaults: {
    'status': { kind: 'lookup', key: 'eingegangen', label: 'Eingegangen' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
