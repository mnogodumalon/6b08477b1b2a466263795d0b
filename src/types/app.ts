import { lookupLabel } from '@/i18n';

// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
/** A raw record URL (applookup reference). NEVER render this directly
 *  in JSX — it is a URL, not a display value. Show the enriched `*Name`
 *  field or resolve it via the entity map instead. Assignable to/from
 *  string everywhere; the `& {}` keeps the alias NAME visible in tsc
 *  error messages (a plain primitive alias gets normalized away). */
export type RecordUrl = string & {};
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface EinreichendePersonen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    vorname?: string;
    nachname?: string;
    email?: string;
    telefon?: string;
    abteilung?: string;
  };
}

export interface Erfindungsmeldungen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    einreichende_person?: RecordUrl; // applookup -> URL zu 'EinreichendePersonen' Record
    melder_vorname?: string;
    melder_nachname?: string;
    melder_email?: string;
    melder_telefon?: string;
    abteilung?: string;
    erfindungsart?: LookupValue;
    titel?: string;
    technisches_gebiet?: string;
    problem?: string;
    loesung?: string;
    vorteile?: string;
    fertigstellung?: string; // Format: YYYY-MM-DD oder ISO String
    miterfinder?: string;
    betriebliche_mittel?: boolean;
    mittel_beschreibung?: string;
    meldedatum?: string; // Format: YYYY-MM-DD oder ISO String
    status?: LookupValue;
  };
}

export interface Bearbeitungsschritte {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    meldung?: RecordUrl; // applookup -> URL zu 'Erfindungsmeldungen' Record
    schrittart?: LookupValue;
    schrittdatum?: string; // Format: YYYY-MM-DD oder ISO String
    bearbeiter_vorname?: string;
    bearbeiter_nachname?: string;
    schrittstatus?: LookupValue;
    notiz?: string;
  };
}

export const APP_IDS = {
  EINREICHENDE_PERSONEN: '6b084762baaf0358ee21dd58',
  ERFINDUNGSMELDUNGEN: '6b084766ff9f9133436d8831',
  BEARBEITUNGSSCHRITTE: '6b084767fbbd89f1536d3adb',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'erfindungsmeldungen': {
    erfindungsart: [{ key: "diensterfindung", get label() { return lookupLabel('erfindungsmeldungen', 'erfindungsart', "diensterfindung") ?? "Diensterfindung"; } }, { key: "freie_erfindung", get label() { return lookupLabel('erfindungsmeldungen', 'erfindungsart', "freie_erfindung") ?? "Freie Erfindung"; } }],
    status: [{ key: "eingegangen", get label() { return lookupLabel('erfindungsmeldungen', 'status', "eingegangen") ?? "Eingegangen"; } }, { key: "in_pruefung", get label() { return lookupLabel('erfindungsmeldungen', 'status', "in_pruefung") ?? "In Prüfung"; } }, { key: "inanspruchgenommen", get label() { return lookupLabel('erfindungsmeldungen', 'status', "inanspruchgenommen") ?? "Inanspruchgenommen"; } }, { key: "freigegeben", get label() { return lookupLabel('erfindungsmeldungen', 'status', "freigegeben") ?? "Freigegeben"; } }, { key: "abgelehnt", get label() { return lookupLabel('erfindungsmeldungen', 'status', "abgelehnt") ?? "Abgelehnt"; } }],
  },
  'bearbeitungsschritte': {
    schrittart: [{ key: "eingangsbestaetigung", get label() { return lookupLabel('bearbeitungsschritte', 'schrittart', "eingangsbestaetigung") ?? "Eingangsbestätigung"; } }, { key: "pruefung", get label() { return lookupLabel('bearbeitungsschritte', 'schrittart', "pruefung") ?? "Prüfung"; } }, { key: "inanspruchnahme", get label() { return lookupLabel('bearbeitungsschritte', 'schrittart', "inanspruchnahme") ?? "Inanspruchnahme"; } }, { key: "freigabe", get label() { return lookupLabel('bearbeitungsschritte', 'schrittart', "freigabe") ?? "Freigabe"; } }, { key: "ablehnung", get label() { return lookupLabel('bearbeitungsschritte', 'schrittart', "ablehnung") ?? "Ablehnung"; } }],
    schrittstatus: [{ key: "offen", get label() { return lookupLabel('bearbeitungsschritte', 'schrittstatus', "offen") ?? "Offen"; } }, { key: "in_bearbeitung", get label() { return lookupLabel('bearbeitungsschritte', 'schrittstatus', "in_bearbeitung") ?? "In Bearbeitung"; } }, { key: "erledigt", get label() { return lookupLabel('bearbeitungsschritte', 'schrittstatus', "erledigt") ?? "Erledigt"; } }],
  },
};

// Optimistic LookupValue writes: never re-type a label — resolve the schema
// option instead (its label is a locale-aware getter; falls back to the key).
// WRONG: status: { key: 'offen', label: 'Offen' }   (frozen in one language)
// RIGHT: status: lookupOption('<appKey>', 'status', 'offen')
export function lookupOption(app: string, field: string, key: string): LookupValue {
  return LOOKUP_OPTIONS[app]?.[field]?.find(o => o.key === key) ?? { key, label: key };
}

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'einreichende_personen': {
    'vorname': 'string/text',
    'nachname': 'string/text',
    'email': 'string/email',
    'telefon': 'string/tel',
    'abteilung': 'string/text',
  },
  'erfindungsmeldungen': {
    'einreichende_person': 'applookup/select',
    'melder_vorname': 'string/text',
    'melder_nachname': 'string/text',
    'melder_email': 'string/email',
    'melder_telefon': 'string/tel',
    'abteilung': 'string/text',
    'erfindungsart': 'lookup/radio',
    'titel': 'string/text',
    'technisches_gebiet': 'string/text',
    'problem': 'string/textarea',
    'loesung': 'string/textarea',
    'vorteile': 'string/textarea',
    'fertigstellung': 'date/date',
    'miterfinder': 'string/textarea',
    'betriebliche_mittel': 'bool',
    'mittel_beschreibung': 'string/textarea',
    'meldedatum': 'date/date',
    'status': 'lookup/select',
  },
  'bearbeitungsschritte': {
    'meldung': 'applookup/select',
    'schrittart': 'lookup/select',
    'schrittdatum': 'date/date',
    'bearbeiter_vorname': 'string/text',
    'bearbeiter_nachname': 'string/text',
    'schrittstatus': 'lookup/radio',
    'notiz': 'string/textarea',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateEinreichendePersonen = StripLookup<EinreichendePersonen['fields']>;
export type CreateErfindungsmeldungen = StripLookup<Erfindungsmeldungen['fields']>;
export type CreateBearbeitungsschritte = StripLookup<Bearbeitungsschritte['fields']>;