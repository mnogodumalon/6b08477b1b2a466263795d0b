/**
 * useMeldungErfassenFlow — the plumbing of the flow « Meldung intern erfassen », generated from the plan.
 *
 * Writes `erfindungsmeldungen`: asks `melder_vorname`, `melder_nachname`, `melder_email`, `erfindungsart`, `titel`, `technisches_gebiet`, `problem`, `loesung`, `vorteile`, `fertigstellung`, `miterfinder`, `betriebliche_mittel`, `mittel_beschreibung`; sets `status` itself.
 * The hook OWNS: the form(s) with exactly these fields and the plan's required
 * ingredients, one record search per picked field (columns and filter from
 * the plan), and the submit plan with its fixed and derived values. A page
 * that only calls `flow.submit.run()` cannot write a field the plan does not
 * know — there is no way to spell it.
 *
 * YOU decide what a person notices, through the options:
 *   steps     which wizard step asks which field (default: one step per pick,
 *             then one for the typed fields, then "Prüfen" = step 2)
 *   items     how a search hit is displayed per pick (title, subtitle, status …)
 *   initial   prefills for typed fields
 *   messages  the sentence for an empty required field, per field
 *
 *   const flow = useMeldungErfassenFlow({
 *     steps: { melder_vorname: 1, melder_nachname: 1, melder_email: 1, erfindungsart: 1, titel: 1, technisches_gebiet: 1, problem: 1, loesung: 1, vorteile: 1, fertigstellung: 1, miterfinder: 1, betriebliche_mittel: 1, mittel_beschreibung: 1 },
 *   });
 *   <IntentWizardShell forms={flow.forms} draftKey={flow.draftKey} …>
 *     <Bound form={flow.forms.erfindungsmeldungen} name="melder_vorname" />
 *     <Bound form={flow.forms.erfindungsmeldungen} name="melder_nachname" />
 *     <Bound form={flow.forms.erfindungsmeldungen} name="melder_email" />
 *     <Bound form={flow.forms.erfindungsmeldungen} name="erfindungsart" />
 *     <Bound form={flow.forms.erfindungsmeldungen} name="titel" />
 *     <Bound form={flow.forms.erfindungsmeldungen} name="technisches_gebiet" />
 *     <Bound form={flow.forms.erfindungsmeldungen} name="problem" />
 *     <Bound form={flow.forms.erfindungsmeldungen} name="loesung" />
 *     <Bound form={flow.forms.erfindungsmeldungen} name="vorteile" />
 *     <Bound form={flow.forms.erfindungsmeldungen} name="fertigstellung" />
 *     <Bound form={flow.forms.erfindungsmeldungen} name="miterfinder" />
 *     <Bound form={flow.forms.erfindungsmeldungen} name="betriebliche_mittel" />
 *     <Bound form={flow.forms.erfindungsmeldungen} name="mittel_beschreibung" />
 *     <StepNav onNext={() => flow.validateStep(n)} />
 *     {!flow.submit.done && <SummaryStep forms={flow.formList} submit={flow.submit} variants={flow.actions} />}
 *     {flow.submit.result && <SuccessStep result={flow.submit.result} forms={flow.formList} submit={flow.submit} />}
 *   </IntentWizardShell>
 */
import { useEffect, useRef, useState } from 'react';
import { readJourneyExtra, writeJourneyExtra } from '@/lib/journey/draft';
import { DOOR_PARENTS, nounOne } from '@/config/plan';
import { syncDoorsAfterWrite } from '@/lib/publicDoors';
import {
  useStepForm, useJourneySubmit, useRecordSearch,
  fieldText, fieldLookup, fieldLookups, fieldNumber, fieldDate, fieldRef,
  todayIso, nowIso, isEmptyValue, policyFixedValue, withPickPolicy, usePolicyVersion,  type StepForm, type JourneyRecord, type RefContext, type SelectItemLike, type FormValues, type PlanStep, type SummaryItem,} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { labelOf, optionsOf, type EntityKey } from '@/lib/journey/rules';
import { entityLabel } from '@/lib/journey/rules';

export type MeldungErfassenFieldKey = 'betriebliche_mittel' | 'erfindungsart' | 'fertigstellung' | 'loesung' | 'melder_email' | 'melder_nachname' | 'melder_vorname' | 'miterfinder' | 'mittel_beschreibung' | 'problem' | 'technisches_gebiet' | 'titel' | 'vorteile';

export interface MeldungErfassenForms {
  erfindungsmeldungen: StepForm<'erfindungsmeldungen'>;
}

// Alias so the option generics stay readable.
type Key = MeldungErfassenFieldKey;

export interface MeldungErfassenFlowOptions {
  /** field → wizard step that asks it; drives „Ändern“ links and answer chips. */
  steps?: Partial<Record<Key, number>>;
  initial?: Partial<Record<Key, unknown>>;
  messages?: Partial<Record<Key, string>>;
}

const DEFAULT_STEPS: Record<string, number> = {"betriebliche_mittel": 1, "erfindungsart": 1, "fertigstellung": 1, "loesung": 1, "melder_email": 1, "melder_nachname": 1, "melder_vorname": 1, "miterfinder": 1, "mittel_beschreibung": 1, "problem": 1, "technisches_gebiet": 1, "titel": 1, "vorteile": 1};
export const MELDUNGERFASSEN_REVIEW_STEP = 2;
// a label of the plan in the page's language
function labelIn(m: Record<string, string>): string {
  const l = (typeof document !== 'undefined' ? document.documentElement.lang : '') || 'de';
  return m[l.slice(0, 2)] ?? m.de ?? Object.values(m)[0] ?? '';
}
// the ways this flow may END (plan: success.actions) — the review shows one
// button per entry, the chosen one sets these values on the primary record
const ACTION_SETS: Record<string, FormValues> = { 'speichern': {"status": "eingegangen"}, 'speichern-und-pruefen': {"status": "in_pruefung"} };

// local calendar day — the ISO-string of a Date is UTC and flips the date in the evening (J-7)
function isoDaysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Returns T, not Partial<T>: a Record's index signature is already "maybe
// absent", and Partial<Record<string, string>> does not assign to the
// Record<string, string> useStepForm wants (tsc, live 23.09.2026 — eight
// errors, one per hook, caught only in the sandbox build).
function only<T extends Record<string, unknown>>(obj: T | undefined, keys: string[]): T | undefined {
  if (!obj) return undefined;
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out as T;
}

function hasValues(form: StepForm): boolean {
  return form.keys.some(k => !isEmptyValue(form.values[k]));
}

export function useMeldungErfassenFlow(options: MeldungErfassenFlowOptions = {}) {
  const steps = { ...DEFAULT_STEPS, ...(options.steps ?? {}) } as Record<string, number>;
  const variantRef = useRef<string | null>(null);   // the end action the person chose (PV-14)
  const erfindungsmeldungen = useStepForm('erfindungsmeldungen', {
    fields: ["melder_vorname", "melder_nachname", "melder_email", "erfindungsart", "titel", "technisches_gebiet", "problem", "loesung", "vorteile", "fertigstellung", "miterfinder", "betriebliche_mittel", "mittel_beschreibung"],
    steps: only(steps, ["melder_vorname", "melder_nachname", "melder_email", "erfindungsart", "titel", "technisches_gebiet", "problem", "loesung", "vorteile", "fertigstellung", "miterfinder", "betriebliche_mittel", "mittel_beschreibung"]) as Record<string, number>,
    // the plan builds a value from these — required here, whatever the app's base view says
    required: { melder_email: true },
    initial: only(options.initial as FormValues | undefined, ["melder_vorname", "melder_nachname", "melder_email", "erfindungsart", "titel", "technisches_gebiet", "problem", "loesung", "vorteile", "fertigstellung", "miterfinder", "betriebliche_mittel", "mittel_beschreibung"]),
    messages: only(options.messages as Record<string, string> | undefined, ["melder_vorname", "melder_nachname", "melder_email", "erfindungsart", "titel", "technisches_gebiet", "problem", "loesung", "vorteile", "fertigstellung", "miterfinder", "betriebliche_mittel", "mittel_beschreibung"]),
  });
  const forms: MeldungErfassenForms = { erfindungsmeldungen };
  // the editor of a list is not a record of its own: the review and the success
  // page read the entries (PlanStep.review), never the half-filled editor
  const formList: StepForm[] = [erfindungsmeldungen];
  // The owner's rules after the build (intent-policies.json): a fixed value
  // for a field this flow sets itself, a narrower or wider pick — read at
  // render time, so a change works on the running application.
  usePolicyVersion();
  const searches = {
  };
  // Whether a pick offers „Neu anlegen“ is the plan's call: off for the record
  // this flow changes, for multi picks, for a catalogue entity and for an
  // entity with its own flow. The page spreads `.select` and writes no `create=`.
  // a fixed value the flow sets itself, as a review row with the link that changes it
  const setting = (entity: EntityKey, field: string, value: unknown): SummaryItem => ({
    key: `setting:${entity}.${field}`, label: labelOf(entity, field),
    value: optionsOf(entity, field).find(o => o.key === String(value))?.label ?? String(value ?? ''),
    href: `#/verwaltung/anwendung?line=intent:meldung-erfassen:write:${entity}.${field}`,
  });
  const picks = {
  };

  const plan: PlanStep[] = [
    {
      key: 'erfindungsmeldungen', entity: 'erfindungsmeldungen', form: erfindungsmeldungen, label: nounOne('erfindungsmeldungen', entityLabel('erfindungsmeldungen')), primary: true,
      values: (): FormValues => ({
        status: policyFixedValue('erfindungsmeldungen', 'status') ?? "eingegangen",
        ...(variantRef.current ? ACTION_SETS[variantRef.current] ?? {} : {}),
      }),

      // the review shows what this step sets itself — changeable on „Deine Anwendung“, not here
      settings: () => [setting('erfindungsmeldungen', 'status', policyFixedValue('erfindungsmeldungen', 'status') ?? "eingegangen")],

      // the planner's assumptions that first act here — shown once with „Passt“ / „ändern“
      notices: () => [{"assumed": "den Schl\u00fcsselinhaber", "id": "mail-empfaenger", "question": "Wer erh\u00e4lt die Mail zu neuen Meldungen?"}],
    },
  ];

  const submit = useJourneySubmit(servicePort, plan, { draftKey: 'meldung-erfassen', onSuccess: (r) => {
    // EF-51: a created or changed parent record keeps its pair of doors in step (made, closed, reopened)
    for (const [k, rec] of Object.entries(r.records)) {
      const ent = plan.find(s => s.key === k)?.entity;
      if (ent && Object.values(DOOR_PARENTS).some(d => d.entity === ent)) void syncDoorsAfterWrite(ent, rec.id, rec.fields);
    }
  } });

  // A typed field the plan prefills from the picked record (`user:from_pick`),
  // still the person's to change: filled once, only while empty (PV-12)
  const prefillFrom = (pickKey: string, rec: JourneyRecord) => {
    void pickKey; void rec;
  };

  // Opened with `?<field>=<value>` for a field this flow asks — a dashboard
  // link that pre-picks the event, a form that hands the question on (J-2):
  // a typed field takes the value while it is empty (a draft wins), a pick
  // loads the record, takes it into the pick and selects it WITH its name.
  // `initial` with a bare record id gets its name the same way.
  const [linkedParams] = useState(() => new URLSearchParams(window.location.hash.split('?')[1] ?? ''));
  useEffect(() => {
    let on = true;
    const coerce = (form: StepForm, key: string, raw: string): unknown => {
      const kind = form.rules[key]?.kind;
      if (kind === 'number') { const n = Number(raw); return Number.isFinite(n) ? n : raw; }
      if (kind === 'bool') return raw === 'true' || raw === '1' || raw === 'ja';
      return raw;
    };
    { const v = linkedParams.get('melder_vorname'); if (v !== null && isEmptyValue(erfindungsmeldungen.get('melder_vorname'))) (erfindungsmeldungen.set as (k: string, v: unknown) => void)('melder_vorname', coerce(erfindungsmeldungen, 'melder_vorname', v)); }
    { const v = linkedParams.get('melder_nachname'); if (v !== null && isEmptyValue(erfindungsmeldungen.get('melder_nachname'))) (erfindungsmeldungen.set as (k: string, v: unknown) => void)('melder_nachname', coerce(erfindungsmeldungen, 'melder_nachname', v)); }
    { const v = linkedParams.get('melder_email'); if (v !== null && isEmptyValue(erfindungsmeldungen.get('melder_email'))) (erfindungsmeldungen.set as (k: string, v: unknown) => void)('melder_email', coerce(erfindungsmeldungen, 'melder_email', v)); }
    { const v = linkedParams.get('erfindungsart'); if (v !== null && isEmptyValue(erfindungsmeldungen.get('erfindungsart'))) (erfindungsmeldungen.set as (k: string, v: unknown) => void)('erfindungsart', coerce(erfindungsmeldungen, 'erfindungsart', v)); }
    { const v = linkedParams.get('titel'); if (v !== null && isEmptyValue(erfindungsmeldungen.get('titel'))) (erfindungsmeldungen.set as (k: string, v: unknown) => void)('titel', coerce(erfindungsmeldungen, 'titel', v)); }
    { const v = linkedParams.get('technisches_gebiet'); if (v !== null && isEmptyValue(erfindungsmeldungen.get('technisches_gebiet'))) (erfindungsmeldungen.set as (k: string, v: unknown) => void)('technisches_gebiet', coerce(erfindungsmeldungen, 'technisches_gebiet', v)); }
    { const v = linkedParams.get('problem'); if (v !== null && isEmptyValue(erfindungsmeldungen.get('problem'))) (erfindungsmeldungen.set as (k: string, v: unknown) => void)('problem', coerce(erfindungsmeldungen, 'problem', v)); }
    { const v = linkedParams.get('loesung'); if (v !== null && isEmptyValue(erfindungsmeldungen.get('loesung'))) (erfindungsmeldungen.set as (k: string, v: unknown) => void)('loesung', coerce(erfindungsmeldungen, 'loesung', v)); }
    { const v = linkedParams.get('vorteile'); if (v !== null && isEmptyValue(erfindungsmeldungen.get('vorteile'))) (erfindungsmeldungen.set as (k: string, v: unknown) => void)('vorteile', coerce(erfindungsmeldungen, 'vorteile', v)); }
    { const v = linkedParams.get('fertigstellung'); if (v !== null && isEmptyValue(erfindungsmeldungen.get('fertigstellung'))) (erfindungsmeldungen.set as (k: string, v: unknown) => void)('fertigstellung', coerce(erfindungsmeldungen, 'fertigstellung', v)); }
    { const v = linkedParams.get('miterfinder'); if (v !== null && isEmptyValue(erfindungsmeldungen.get('miterfinder'))) (erfindungsmeldungen.set as (k: string, v: unknown) => void)('miterfinder', coerce(erfindungsmeldungen, 'miterfinder', v)); }
    { const v = linkedParams.get('betriebliche_mittel'); if (v !== null && isEmptyValue(erfindungsmeldungen.get('betriebliche_mittel'))) (erfindungsmeldungen.set as (k: string, v: unknown) => void)('betriebliche_mittel', coerce(erfindungsmeldungen, 'betriebliche_mittel', v)); }
    { const v = linkedParams.get('mittel_beschreibung'); if (v !== null && isEmptyValue(erfindungsmeldungen.get('mittel_beschreibung'))) (erfindungsmeldungen.set as (k: string, v: unknown) => void)('mittel_beschreibung', coerce(erfindungsmeldungen, 'mittel_beschreibung', v)); }
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per link
  }, []);

  /** Props for a single-record pick step: {...flow.picks.x.select} {...flow.pick('x')} */
  const pick = (field: MeldungErfassenFieldKey) => {
    const owner = formList.find(f => f.keys.includes(field)) ?? formList[0];
    const search = (picks as Record<string, { labelOf(id: string): string | undefined; recordOf?(id: string): JourneyRecord | undefined }>)[field];
    return {
      selectedId: (typeof owner.get(field) === 'string' ? (owner.get(field) as string) : null) || null,
      // `field as never` collapsed the conditional SetArgs<E, never> to never and
      // no argument was assignable any more (tsc, live 23.09.2026); widen `set`
      // itself instead — the label stays a required third argument.
      onSelect: (id: string) => {
        (owner.set as (k: string, v: unknown, l?: string) => void)(field, id, search?.labelOf(id));
        const rec = search?.recordOf?.(id);
        if (rec) prefillFrom(field, rec);
      },
    };
  };
  /** Props for a multi-record pick step: {...flow.picks.x.select} {...flow.pickMany('x')} */
  const pickMany = (field: MeldungErfassenFieldKey) => {
    const owner = formList.find(f => f.keys.includes(field)) ?? formList[0];
    const search = (picks as Record<string, { labelOf(id: string): string | undefined }>)[field];
    return owner.records(field, id => search?.labelOf(id));
  };
  /** Validate every field the wizard asks in step `n` — for StepNav.onNext. */
  const validateStep = (n: number): boolean =>
    formList.every(f => f.validate(f.keys.filter(k => steps[k] === n)));
  const reset = () => { submit.reset(); formList.forEach(f => f.reset()); };

  /** The ways this flow may end — spread as `variants={flow.actions}` onto <SummaryStep> (PV-14). */
  const flowActions = [
    { id: 'speichern', label: labelIn({"de": "Speichern", "en": "Save"}), confirm: () => { variantRef.current = 'speichern'; return submit.run(); } },
    { id: 'speichern-und-pruefen', label: labelIn({"de": "Speichern und in Pr\u00fcfung setzen", "en": "Save and set to under review"}), confirm: () => { variantRef.current = 'speichern-und-pruefen'; return submit.run(); } },
  ];
  return {
    slug: 'meldung-erfassen' as const,
    draftKey: 'meldung-erfassen' as const,    actions: flowActions,    entity: 'erfindungsmeldungen' as const,
    form: erfindungsmeldungen,
    forms, formList, picks, submit, steps,    reviewStep: MELDUNGERFASSEN_REVIEW_STEP,
    pick, pickMany, validateStep, reset,    // the door the hook reads through — for what it does not own: availability
    // (useOccupancy(flow.port, …)), a count (useRecordCount(flow.port, …)). A page
    // importing servicePort next to the hook fails gate 3 (fewo 05.10.2026: the
    // gate taught useOccupancy(servicePort, …) and forbade servicePort at once)
    port: servicePort,
  };
}

export type MeldungErfassenFlow = ReturnType<typeof useMeldungErfassenFlow>;
