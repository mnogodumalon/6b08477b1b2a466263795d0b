/**
 * useMeldungBearbeitenFlow — the plumbing of the flow « Meldung bearbeiten », generated from the plan.
 *
 * Writes `bearbeitungsschritte`: asks `meldung`, `schrittart`, `bearbeiter_vorname`, `bearbeiter_nachname`, `schrittstatus`, `notiz`; sets `schrittdatum` itself.
Changes `erfindungsmeldungen`: the record to change is picked (`flow.pick('erfindungsmeldungen')`), the form is prefilled with its values; asks `status`.
 * The hook OWNS: the form(s) with exactly these fields and the plan's required
 * ingredients, one record search per picked field (columns and filter from
 * the plan), and the submit plan with its fixed and derived values. A page
 * that only calls `flow.submit.run()` cannot write a field the plan does not
 * know — there is no way to spell it.
 *
 * YOU decide what a person notices, through the options:
 *   steps     which wizard step asks which field (default: one step per pick,
 *             then one for the typed fields, then "Prüfen" = step 4)
 *   items     how a search hit is displayed per pick (title, subtitle, status …)
 *   initial   prefills for typed fields
 *   messages  the sentence for an empty required field, per field
 *
 *   const flow = useMeldungBearbeitenFlow({
 *     steps: { erfindungsmeldungen: 1, meldung: 2, schrittart: 3, bearbeiter_vorname: 3, bearbeiter_nachname: 3, schrittstatus: 3, notiz: 3, status: 3 },
 *     items: { meldung: r => ({ id: r.id, title: fieldText(r, 'titel') }) },
 *   });
 *   <IntentWizardShell forms={flow.forms} draftKey={flow.draftKey} …>
 *     <EntitySelectStep {...flow.picks.meldung.select} {...flow.pick('meldung')} />
 *     // the record this flow changes: <EntitySelectStep {...flow.picks.erfindungsmeldungen.select} {...flow.pick('erfindungsmeldungen')} />
 *     <Bound form={flow.forms.bearbeitungsschritte} name="schrittart" />
 *     <Bound form={flow.forms.bearbeitungsschritte} name="bearbeiter_vorname" />
 *     <Bound form={flow.forms.bearbeitungsschritte} name="bearbeiter_nachname" />
 *     <Bound form={flow.forms.bearbeitungsschritte} name="schrittstatus" />
 *     <Bound form={flow.forms.bearbeitungsschritte} name="notiz" />
 *     <Bound form={flow.forms.erfindungsmeldungen} name="status" />
 *     <StepNav onNext={() => flow.validateStep(n)} />
 *     {!flow.submit.done && <SummaryStep forms={flow.formList} submit={flow.submit} />}
 *     {flow.submit.result && <SuccessStep result={flow.submit.result} forms={flow.formList} submit={flow.submit} undo={flow.undo} />}
 *   </IntentWizardShell>
 */
import { useEffect, useRef, useState } from 'react';
import { readJourneyExtra, writeJourneyExtra } from '@/lib/journey/draft';
import { DOOR_PARENTS, nounOne } from '@/config/plan';
import { syncDoorsAfterWrite } from '@/lib/publicDoors';
import {
  useStepForm, useJourneySubmit, useRecordSearch,
  fieldText, fieldLookup, fieldLookups, fieldNumber, fieldDate, fieldRef,
  todayIso, nowIso, isEmptyValue, policyFixedValue, withPickPolicy, usePolicyVersion,  type StepForm, type JourneyRecord, type RefContext, type SelectItemLike, type FormValues, type PlanStep,} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { requestWizardStep } from '@/lib/journey/useStepForm';
import { reportReadFailure } from '@/lib/journey/readFailures';
import { pickHint, whereSentence, type PickWhere } from '@/lib/journey/policy';
import { labelOf, optionsOf, type EntityKey } from '@/lib/journey/rules';
import { entityLabel } from '@/lib/journey/rules';

export type MeldungBearbeitenFieldKey = 'bearbeiter_nachname' | 'bearbeiter_vorname' | 'erfindungsmeldungen' | 'meldung' | 'notiz' | 'schrittart' | 'schrittstatus' | 'status';

export interface MeldungBearbeitenForms {
  bearbeitungsschritte: StepForm<'bearbeitungsschritte'>;
  erfindungsmeldungen: StepForm<'erfindungsmeldungen'>;
}

// Alias so the option generics stay readable.
type Key = MeldungBearbeitenFieldKey;

export interface MeldungBearbeitenFlowOptions {
  /** field → wizard step that asks it; drives „Ändern“ links and answer chips. */
  steps?: Partial<Record<Key, number>>;
  initial?: Partial<Record<Key, unknown>>;
  messages?: Partial<Record<Key, string>>;
  /** How a search hit reads — the card's title/subtitle/status per pick. */
  items?: {
    meldung?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
    erfindungsmeldungen?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
  };
  /** A page-side narrowing per pick, on top of the plan's filter (J-3): the
   *  questions of the picked event, the open ones — `r => fieldRef(r, 'veranstaltung') === eventId`. */
  where?: {
    meldung?: (record: JourneyRecord) => boolean;
    erfindungsmeldungen?: (record: JourneyRecord) => boolean;
  };
}

const DEFAULT_STEPS: Record<string, number> = {"bearbeiter_nachname": 3, "bearbeiter_vorname": 3, "erfindungsmeldungen": 1, "meldung": 2, "notiz": 3, "schrittart": 3, "schrittstatus": 3, "status": 3};
export const MELDUNGBEARBEITEN_REVIEW_STEP = 4;
// a label of the plan in the page's language
function labelIn(m: Record<string, string>): string {
  const l = (typeof document !== 'undefined' ? document.documentElement.lang : '') || 'de';
  return m[l.slice(0, 2)] ?? m.de ?? Object.values(m)[0] ?? '';
}
// the counter-action (plan: undo) — what puts the changed record back
const UNDO_SETS: Record<string, unknown> = {"status": "eingegangen"};

function fromPick<T>(pick: { recordOf(id: string): JourneyRecord | undefined }, form: StepForm, field: string, read: (r: JourneyRecord) => T): T | undefined {
  const id = form.get(field);
  const rec = typeof id === 'string' && id ? pick.recordOf(id) : undefined;
  return rec ? read(rec) : undefined;
}
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
// The picked record as `?record=<id>` in the address — a reload or a shared
// address opens the flow on the same record (J-8). replaceState: no navigation.
function mirrorRecordParam(id: string | null): void {
  try {
    const [base, query = ''] = window.location.hash.split('?');
    const q = new URLSearchParams(query);
    if (id) q.set('record', id); else q.delete('record');
    const qs = q.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${base}${qs ? `?${qs}` : ''}`);
  } catch {
    /* ignore */
  }
}

export function useMeldungBearbeitenFlow(options: MeldungBearbeitenFlowOptions = {}) {
  const steps = { ...DEFAULT_STEPS, ...(options.steps ?? {}) } as Record<string, number>;
  const [erfindungsmeldungenTargetId, setErfindungsmeldungenTargetId] = useState<string | null>(null);
  const bearbeitungsschritte = useStepForm('bearbeitungsschritte', {
    fields: ["meldung", "schrittart", "bearbeiter_vorname", "bearbeiter_nachname", "schrittstatus", "notiz"],
    steps: only(steps, ["meldung", "schrittart", "bearbeiter_vorname", "bearbeiter_nachname", "schrittstatus", "notiz"]) as Record<string, number>,
    initial: only(options.initial as FormValues | undefined, ["meldung", "schrittart", "bearbeiter_vorname", "bearbeiter_nachname", "schrittstatus", "notiz"]),
    messages: only(options.messages as Record<string, string> | undefined, ["meldung", "schrittart", "bearbeiter_vorname", "bearbeiter_nachname", "schrittstatus", "notiz"]),
  });
  const erfindungsmeldungen = useStepForm('erfindungsmeldungen', {
    fields: ["status"],
    steps: only(steps, ["status"]) as Record<string, number>,
    initial: only(options.initial as FormValues | undefined, ["status"]),
    messages: only(options.messages as Record<string, string> | undefined, ["status"]),
  });
  const forms: MeldungBearbeitenForms = { bearbeitungsschritte, erfindungsmeldungen };
  // the editor of a list is not a record of its own: the review and the success
  // page read the entries (PlanStep.review), never the half-filled editor
  const formList: StepForm[] = [bearbeitungsschritte, erfindungsmeldungen];
  // The owner's rules after the build (intent-policies.json): a fixed value
  // for a field this flow sets itself, a narrower or wider pick — read at
  // render time, so a change works on the running application.
  usePolicyVersion();
  const searches = {
    meldung: useRecordSearch(servicePort, 'erfindungsmeldungen', withPickPolicy('meldung', {
      searchFields: ["titel", "melder_nachname"] as never,
      filter: "r.v_status in ['eingegangen', 'in_pruefung', 'inanspruchgenommen']",
      where: (r: JourneyRecord) => (["eingegangen", "in_pruefung", "inanspruchgenommen"].includes(fieldLookup(r, "status")?.key ?? '')) && (options.where?.meldung?.(r) ?? true),
      toItem: options.items?.meldung as never,
      claim: 'bearbeitungsschritte.meldung',
    })),
    erfindungsmeldungen: useRecordSearch(servicePort, 'erfindungsmeldungen', withPickPolicy('erfindungsmeldungen', {
      searchFields: ["titel", "melder_nachname"] as never,
      filter: "r.v_status in ['eingegangen', 'in_pruefung', 'inanspruchgenommen']",
      where: (r: JourneyRecord) => (["eingegangen", "in_pruefung", "inanspruchgenommen"].includes(fieldLookup(r, "status")?.key ?? '')) && (options.where?.erfindungsmeldungen?.(r) ?? true),
      toItem: options.items?.erfindungsmeldungen as never,
      includeTaken: true,
    })),
  };
  // Whether a pick offers „Neu anlegen“ is the plan's call: off for the record
  // this flow changes, for multi picks, for a catalogue entity and for an
  // entity with its own flow. The page spreads `.select` and writes no `create=`.
  // what the person sees under the search field: the rule that narrows the
  // pick (the owner's, else the plan's) — and the link that changes it
  const hintFor = (key: string, entity: EntityKey, planned: PickWhere | null) => pickHint(key, planned,
    w => whereSentence(w, f => labelOf(entity, f), (f, v) => optionsOf(entity, f).find(o => o.key === String(v))?.label ?? String(v)),
    `#/verwaltung/anwendung?line=intent:meldung-bearbeiten:read:${entity}`);
  const picks = {
    meldung: { ...searches.meldung, select: { ...searches.meldung.select, create: false as boolean, hint: hintFor('meldung', 'erfindungsmeldungen', {"conditions": [{"field": "status", "op": "in", "value": ["eingegangen", "in_pruefung", "inanspruchgenommen"]}], "mode": "all"} as PickWhere | null) } },
    erfindungsmeldungen: { ...searches.erfindungsmeldungen, select: { ...searches.erfindungsmeldungen.select, create: false as boolean, hint: hintFor('erfindungsmeldungen', 'erfindungsmeldungen', {"conditions": [{"field": "status", "op": "in", "value": ["eingegangen", "in_pruefung", "inanspruchgenommen"]}], "mode": "all"} as PickWhere | null) } },
  };

  const plan: PlanStep[] = [
    {
      key: 'bearbeitungsschritte', entity: 'bearbeitungsschritte', form: bearbeitungsschritte, label: nounOne('bearbeitungsschritte', entityLabel('bearbeitungsschritte')), primary: true,
      values: (): FormValues => ({
        schrittdatum: policyFixedValue('bearbeitungsschritte', 'schrittdatum') ?? todayIso(),
      }),

      // the planner's assumptions that first act here — shown once with „Passt“ / „ändern“
      notices: () => [{"assumed": "vom Sachbearbeiter", "id": "status-nach-schritt", "question": "Setzt der Sachbearbeiter den Status der Meldung selbst?"}],
    },
    {
      key: 'erfindungsmeldungen', entity: 'erfindungsmeldungen', form: erfindungsmeldungen, label: nounOne('erfindungsmeldungen', entityLabel('erfindungsmeldungen')),
      updates: () => erfindungsmeldungenTargetId ?? undefined,
      // the review names the record this step changes; "Ändern" leads back to its pick
      target: () => erfindungsmeldungenTargetId
        ? { key: 'target:erfindungsmeldungen', label: nounOne('erfindungsmeldungen', entityLabel('erfindungsmeldungen')), value: picks.erfindungsmeldungen.labelOf(erfindungsmeldungenTargetId) ?? erfindungsmeldungenTargetId, step: steps.erfindungsmeldungen }
        : undefined,    },
  ];

  const submit = useJourneySubmit(servicePort, plan, { draftKey: 'meldung-bearbeiten', onSuccess: (r) => {
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
    { const v = linkedParams.get('schrittart'); if (v !== null && isEmptyValue(bearbeitungsschritte.get('schrittart'))) (bearbeitungsschritte.set as (k: string, v: unknown) => void)('schrittart', coerce(bearbeitungsschritte, 'schrittart', v)); }
    { const v = linkedParams.get('bearbeiter_vorname'); if (v !== null && isEmptyValue(bearbeitungsschritte.get('bearbeiter_vorname'))) (bearbeitungsschritte.set as (k: string, v: unknown) => void)('bearbeiter_vorname', coerce(bearbeitungsschritte, 'bearbeiter_vorname', v)); }
    { const v = linkedParams.get('bearbeiter_nachname'); if (v !== null && isEmptyValue(bearbeitungsschritte.get('bearbeiter_nachname'))) (bearbeitungsschritte.set as (k: string, v: unknown) => void)('bearbeiter_nachname', coerce(bearbeitungsschritte, 'bearbeiter_nachname', v)); }
    { const v = linkedParams.get('schrittstatus'); if (v !== null && isEmptyValue(bearbeitungsschritte.get('schrittstatus'))) (bearbeitungsschritte.set as (k: string, v: unknown) => void)('schrittstatus', coerce(bearbeitungsschritte, 'schrittstatus', v)); }
    { const v = linkedParams.get('notiz'); if (v !== null && isEmptyValue(bearbeitungsschritte.get('notiz'))) (bearbeitungsschritte.set as (k: string, v: unknown) => void)('notiz', coerce(bearbeitungsschritte, 'notiz', v)); }
    { const v = linkedParams.get('status'); if (v !== null && isEmptyValue(erfindungsmeldungen.get('status'))) (erfindungsmeldungen.set as (k: string, v: unknown) => void)('status', coerce(erfindungsmeldungen, 'status', v)); }
    {
      const cur = forms.bearbeitungsschritte.get('meldung');
      const fromLink = linkedParams.get('meldung');
      const unnamed = typeof cur === 'string' && cur !== '' && !forms.bearbeitungsschritte.labels[cur] ? cur : null;
      const id = fromLink && isEmptyValue(cur) ? fromLink : unnamed;
      if (id) void servicePort.get('erfindungsmeldungen', id).then(rec => {
        if (!on || !rec) return;
        picks.meldung.adopt(rec);
        const name = picks.meldung.labelOf(rec.id) ?? rec.id;
        (forms.bearbeitungsschritte.set as (k: string, v: unknown, l?: string) => void)('meldung', rec.id, name);
        prefillFrom('meldung', rec);
      }).catch(() => undefined);
    }
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per link
  }, []);

  /** The record(s) this flow CHANGES: picked through {...flow.picks.<entity>.select} {...flow.pick('<entity>')};
   *  picking prefills the form with the record's current values, and the plan step updates that record. */
  const targets = {
    erfindungsmeldungen: {
      selectedId: erfindungsmeldungenTargetId,
      onSelect: (id: string) => {
        setErfindungsmeldungenTargetId(id);
        const rec = picks.erfindungsmeldungen.recordOf(id);
        if (rec) erfindungsmeldungen.reset({ status: fieldLookup(rec, "status")?.key, });
        // survives a reload: in the draft's side data, and as `?record=` in the address (J-8)
        writeJourneyExtra('meldung-bearbeiten', 'target:erfindungsmeldungen', id);
        mirrorRecordParam(id);
      },
      get record(): JourneyRecord | undefined { return erfindungsmeldungenTargetId ? picks.erfindungsmeldungen.recordOf(erfindungsmeldungenTargetId) : undefined; },
    },
  };
  // Opened for one record — `#/intents/meldung-bearbeiten?record=<id>`, the dashboard's
  // flowActionFor(): that record is the one to change. Loaded, taken into the
  // pick and selected — when this flow may change it at all (the pick's rule).
  // After a reload the pick comes back the same way: from the address, else
  // from the draft's side data (J-8).
  const [linkedId] = useState(() => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('record')
    ?? readJourneyExtra<string>('meldung-bearbeiten', 'target:erfindungsmeldungen'));
  useEffect(() => {
    if (!linkedId) return;
    let on = true;
    void servicePort.get('erfindungsmeldungen', linkedId).then(rec => {
      if (!on || !rec || !((r: JourneyRecord) => ["eingegangen", "in_pruefung", "inanspruchgenommen"].includes(fieldLookup(r, "status")?.key ?? ''))(rec)) return;
      reportReadFailure('meldung-bearbeiten:linked', null);
      picks.erfindungsmeldungen.adopt(rec);
      targets.erfindungsmeldungen.onSelect(rec.id);
      // the link named the record — start after the steps that pick it, without the start screen
      const after = Math.max(...Object.keys(targets).map(k => steps[k] ?? 1)) + 1;
      if (new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('record') === linkedId) requestWizardStep(after);
    }).catch(() => { if (on) reportReadFailure('meldung-bearbeiten:linked', 'erfindungsmeldungen'); });
    return () => { on = false; reportReadFailure('meldung-bearbeiten:linked', null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per link
  }, [linkedId]);
  /** Props for a single-record pick step: {...flow.picks.x.select} {...flow.pick('x')} */
  const pick = (field: MeldungBearbeitenFieldKey) => {
    if (field in targets) {
      const t = targets[field as keyof typeof targets];
      return { selectedId: t.selectedId, onSelect: t.onSelect };
    }
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
  const pickMany = (field: MeldungBearbeitenFieldKey) => {
    const owner = formList.find(f => f.keys.includes(field)) ?? formList[0];
    const search = (picks as Record<string, { labelOf(id: string): string | undefined }>)[field];
    return owner.records(field, id => search?.labelOf(id));
  };
  /** Validate every field the wizard asks in step `n` — for StepNav.onNext. */
  const validateStep = (n: number): boolean =>
    formList.every(f => f.validate(f.keys.filter(k => steps[k] === n)))    && Object.entries(targets).every(([k, t]) => steps[k] !== n || !!t.selectedId);
  const reset = () => { submit.reset(); formList.forEach(f => f.reset()); setErfindungsmeldungenTargetId(null); writeJourneyExtra('meldung-bearbeiten', 'target:erfindungsmeldungen', null); mirrorRecordParam(null); };

  /** The counter-action of the changed record — `undo={flow.undo}` on <SuccessStep> (PV-15). */
  const flowUndo = erfindungsmeldungenTargetId
    ? { label: labelIn({"de": "Status zur\u00fccksetzen", "en": "Reset status"}), run: async () => {
        const id = erfindungsmeldungenTargetId;
        await servicePort.update('erfindungsmeldungen', id, UNDO_SETS);
        // the way back is a write like any other: the record's doors follow (a reopened record
        // takes submissions again, EF-58) and the overview re-reads
        if (Object.values(DOOR_PARENTS).some(d => d.entity === 'erfindungsmeldungen')) await syncDoorsAfterWrite('erfindungsmeldungen', id, UNDO_SETS);
        window.dispatchEvent(new CustomEvent('assistant:data-changed'));
      } }
    : undefined;
  return {
    slug: 'meldung-bearbeiten' as const,
    draftKey: 'meldung-bearbeiten' as const,    undo: flowUndo,    entity: 'bearbeitungsschritte' as const,
    form: bearbeitungsschritte,
    forms, formList, picks, submit, steps, targets,    reviewStep: MELDUNGBEARBEITEN_REVIEW_STEP,
    pick, pickMany, validateStep, reset,    // the door the hook reads through — for what it does not own: availability
    // (useOccupancy(flow.port, …)), a count (useRecordCount(flow.port, …)). A page
    // importing servicePort next to the hook fails gate 3 (fewo 05.10.2026: the
    // gate taught useOccupancy(servicePort, …) and forbade servicePort at once)
    port: servicePort,
  };
}

export type MeldungBearbeitenFlow = ReturnType<typeof useMeldungBearbeitenFlow>;
