/**
 * EntityCrud — pre-generated CRUD + overlay plumbing for the dashboard.
 * Compose it; NEVER re-roll dialog state, submit handlers, an overlay stack
 * or a RecordOverlayHost in the page — this file owns all of it.
 *
 * API at a glance:
 *   const data = useDashboardData();
 *   const crud = useEntityCrud(data, {
 *     // optional — the ONE semantic slot on the overlay: the record's next
 *     // workflow step. Return undefined for types without one.
 *     footer: (top) => top.type === 'einreichendePersonen'
 *       ? { label: …, onClick: () => … }
 *       : undefined,
 *   });
 *
 *   `top.type` is the SAME camelCase key as `crud.<entity>` — one spelling
 *   per entity, everywhere in this API.
 *   …
 *   crud.einreichendePersonen.openCreate({ …defaults })   // create dialog, prefilled — defaults are
 *                                       // shape-tolerant: bare lookup keys / record ids are fine
 *   crud.einreichendePersonen.openEdit(record)            // edit dialog (recordId + defaults wired)
 *   crud.einreichendePersonen.openDetail(record)          // record overlay — pass the RAW record,
 *                                       // enrichment is resolved inside
 *   crud.overlay                         // RecordOverlayStack<OverlayItem> for drills:
 *                                       // push / pop / replace / close
 *   crud.enriched.einreichendePersonen              // the display-ready array for EVERY entity —
 *                                       // Enriched* where relations exist, the raw array
 *                                       // otherwise. Reuse these; never call enrich*()
 *                                       // in the page, and never guess which entity has
 *                                       // one: they all do.
 *   {crud.surfaces}                      // render ONCE at the end of the page JSX:
 *                                       // all entity dialogs + the overlay host
 *
 * Built in (do NOT re-implement): optimistic update + Rückgängig counter-write
 * on edit, fetchAll-on-error, edit-from-overlay, and per-entity overlay bodies
 * (RecordHeader + <{Entity}Details> with every relation reachable and the
 * contextual "+" prefilled; list-field back-references additionally get a
 * "choose existing" picker that links an EXISTING record — built in, do not
 * re-roll). Drag writes (onEventDrop/onCardMove) stay YOURS:
 * optimistic setter first, PATCH in background, undoToast with counter-write.
 *
 * Overlay content per entity (the host renders these — you never compose
 * Details blocks yourself):
 *   einreichende_personen: vorname, nachname, email, telefon, abteilung  ·  ← erfindungsmeldungen (list + contextual +)
 *   erfindungsmeldungen: einreichende_person, melder_vorname, melder_nachname, melder_email, melder_telefon, abteilung, erfindungsart, titel, …  ·  → einreichende_personen · ← bearbeitungsschritte (list + contextual +)
 *   bearbeitungsschritte: meldung, schrittart, schrittdatum, bearbeiter_vorname, bearbeiter_nachname, schrittstatus, notiz  ·  → erfindungsmeldungen
 */
import { useState, useMemo, type ReactNode } from 'react';
import type { EinreichendePersonen, Erfindungsmeldungen, Bearbeitungsschritte } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { enrichErfindungsmeldungen, enrichBearbeitungsschritte } from '@/lib/enrich';
import type { EnrichedErfindungsmeldungen, EnrichedBearbeitungsschritte } from '@/types/enriched';
import { useDashboardData } from '@/hooks/useDashboardData';
import {
  useRecordOverlayStack, RecordOverlayHost, RecordHeader,
  type RecordOverlayStack,
} from '@/components/widgets/RecordView';
import { EinreichendePersonenDialog, type EinreichendePersonenDialogDefaults } from '@/components/dialogs/EinreichendePersonenDialog';
import { EinreichendePersonenDetails } from '@/components/details/EinreichendePersonenDetails';
import { ErfindungsmeldungenDialog, type ErfindungsmeldungenDialogDefaults } from '@/components/dialogs/ErfindungsmeldungenDialog';
import { ErfindungsmeldungenDetails } from '@/components/details/ErfindungsmeldungenDetails';
import { BearbeitungsschritteDialog, type BearbeitungsschritteDialogDefaults } from '@/components/dialogs/BearbeitungsschritteDialog';
import { BearbeitungsschritteDetails } from '@/components/details/BearbeitungsschritteDetails';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { t, appLabel } from '@/i18n';
import { undoToast } from '@/lib/polish';
import { usePermissions } from '@/lib/permissions';
import { toast } from 'sonner';
import { syncDoorsAfterWrite } from '@/lib/publicDoors';
import { displayNameOf, displayPart } from '@/lib/journey/rules';
import { formatDate } from '@/lib/formatters';

// The overlay union — one branch per entity, `record` typed the way the data
// flows: Enriched* where enrichment exists, the raw record type otherwise.
// The host resolves enrichment itself; pages pass raw records everywhere.
export type OverlayItem =
  | { type: 'einreichendePersonen'; record: EinreichendePersonen }
  | { type: 'erfindungsmeldungen'; record: EnrichedErfindungsmeldungen }
  | { type: 'bearbeitungsschritte'; record: EnrichedBearbeitungsschritte };

/** The useDashboardData() return — pass it in, never re-fetch inside. */
export type EntityCrudData = ReturnType<typeof useDashboardData>;

export interface EntityCrudOptions {
  /** Per-type overlay footer — the record's next workflow step. */
  /** The action may return a sentence — the reason the step was NOT taken; the overlay shows it under the button. */
  footer?: (top: OverlayItem) => ReactNode | { label: ReactNode; onClick: () => void | string | Promise<void | string> } | undefined;
  placement?: 'side' | 'center';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface EntityCrudApi<TRecord, TDefaults> {
  /** Open the create dialog, optionally prefilled (shape-tolerant defaults). */
  openCreate: (defaults?: TDefaults) => void;
  /** Open the edit dialog for a record (recordId + defaults are wired). */
  openEdit: (record: TRecord) => void;
  /** Open the record overlay (raw record is fine — enrichment resolved inside). */
  openDetail: (record: TRecord) => void;
  /** May the signed-in user create/change records of this list? (the
   *  platform's rights — show a „+ Neu“ only when true; openCreate/openEdit
   *  refuse with a notice otherwise). */
  canWrite: boolean;
}

export interface EntityCrud {
  /** The overlay stack for drills: push / pop / replace / close. */
  overlay: RecordOverlayStack<OverlayItem>;
  /** Render ONCE at the end of the page JSX — all dialogs + the overlay host. */
  surfaces: ReactNode;
  einreichendePersonen: EntityCrudApi<EinreichendePersonen, EinreichendePersonenDialogDefaults>;
  erfindungsmeldungen: EntityCrudApi<Erfindungsmeldungen, ErfindungsmeldungenDialogDefaults>;
  bearbeitungsschritte: EntityCrudApi<Bearbeitungsschritte, BearbeitungsschritteDialogDefaults>;
  /** The display-ready array per entity: Enriched* where an enrich function
   *  exists, the raw array otherwise. One key per entity so no page has to
   *  know which is which. Reuse these; never re-enrich in the page. */
  enriched: { einreichendePersonen: EinreichendePersonen[]; erfindungsmeldungen: EnrichedErfindungsmeldungen[]; bearbeitungsschritte: EnrichedBearbeitungsschritte[] };
}

export function useEntityCrud(data: EntityCrudData, options?: EntityCrudOptions): EntityCrud {
  const overlay = useRecordOverlayStack<OverlayItem>();
  // the platform's rights of the signed-in user (lib/permissions.ts) — unknown = allowed
  const perms = usePermissions();
  const refuse = () => { toast.error(t('perm_denied_title'), { description: t('perm_denied_desc') }); };
  const [einreichendePersonenDialog, setEinreichendePersonenDialog] = useState<{ defaults?: EinreichendePersonenDialogDefaults; editing?: EinreichendePersonen } | null>(null);
  const [erfindungsmeldungenDialog, setErfindungsmeldungenDialog] = useState<{ defaults?: ErfindungsmeldungenDialogDefaults; editing?: Erfindungsmeldungen } | null>(null);
  const [bearbeitungsschritteDialog, setBearbeitungsschritteDialog] = useState<{ defaults?: BearbeitungsschritteDialogDefaults; editing?: Bearbeitungsschritte } | null>(null);
  const enrichedErfindungsmeldungen = useMemo(() => enrichErfindungsmeldungen(data.erfindungsmeldungen, { einreichendePersonenMap: data.einreichendePersonenMap }), [data.erfindungsmeldungen, data.einreichendePersonenMap]);
  const enrichedBearbeitungsschritte = useMemo(() => enrichBearbeitungsschritte(data.bearbeitungsschritte, { erfindungsmeldungenMap: data.erfindungsmeldungenMap }), [data.bearbeitungsschritte, data.erfindungsmeldungenMap]);

  function detailEinreichendePersonen(record: EinreichendePersonen, push = false) {
    const item: OverlayItem = { type: 'einreichendePersonen', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitEinreichendePersonen(fields: EinreichendePersonen['fields']) {
    const editing = einreichendePersonenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setEinreichendePersonen(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateEinreichendePersonenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('einreichende_personen')} — ${t('crud_updated')}`, async () => {
        data.setEinreichendePersonen(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateEinreichendePersonenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
      void syncDoorsAfterWrite('einreichende_personen', editing.record_id, fields as Record<string, unknown>);
    } else {
      const made = await LivingAppsService.createEinreichendePersonenEntry(fields);
      undoToast(`${appLabel('einreichende_personen')} — ${t('crud_created')}`);
      // EF-51: a new parent record gets its pair of doors right away (the record's own link)
      const madeId = (made as { id?: string; record_id?: string } | undefined)?.id ?? (made as { record_id?: string } | undefined)?.record_id;
      if (madeId) void syncDoorsAfterWrite('einreichende_personen', madeId, fields as Record<string, unknown>).then(r => { if (!r.ok) toast.error(r.message ? `${t('door_failed')}: ${r.message}` : t('door_failed_later')); });
      data.fetchAll();
    }
  }

  function detailErfindungsmeldungen(record: Erfindungsmeldungen, push = false) {
    const rec = enrichedErfindungsmeldungen.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'erfindungsmeldungen', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitErfindungsmeldungen(fields: Erfindungsmeldungen['fields']) {
    const editing = erfindungsmeldungenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setErfindungsmeldungen(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateErfindungsmeldungenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('erfindungsmeldungen')} — ${t('crud_updated')}`, async () => {
        data.setErfindungsmeldungen(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateErfindungsmeldungenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
      void syncDoorsAfterWrite('erfindungsmeldungen', editing.record_id, fields as Record<string, unknown>);
    } else {
      const made = await LivingAppsService.createErfindungsmeldungenEntry(fields);
      undoToast(`${appLabel('erfindungsmeldungen')} — ${t('crud_created')}`);
      // EF-51: a new parent record gets its pair of doors right away (the record's own link)
      const madeId = (made as { id?: string; record_id?: string } | undefined)?.id ?? (made as { record_id?: string } | undefined)?.record_id;
      if (madeId) void syncDoorsAfterWrite('erfindungsmeldungen', madeId, fields as Record<string, unknown>).then(r => { if (!r.ok) toast.error(r.message ? `${t('door_failed')}: ${r.message}` : t('door_failed_later')); });
      data.fetchAll();
    }
  }

  function detailBearbeitungsschritte(record: Bearbeitungsschritte, push = false) {
    const rec = enrichedBearbeitungsschritte.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'bearbeitungsschritte', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitBearbeitungsschritte(fields: Bearbeitungsschritte['fields']) {
    const editing = bearbeitungsschritteDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setBearbeitungsschritte(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateBearbeitungsschritteEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('bearbeitungsschritte')} — ${t('crud_updated')}`, async () => {
        data.setBearbeitungsschritte(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateBearbeitungsschritteEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
      void syncDoorsAfterWrite('bearbeitungsschritte', editing.record_id, fields as Record<string, unknown>);
    } else {
      const made = await LivingAppsService.createBearbeitungsschritteEntry(fields);
      undoToast(`${appLabel('bearbeitungsschritte')} — ${t('crud_created')}`);
      // EF-51: a new parent record gets its pair of doors right away (the record's own link)
      const madeId = (made as { id?: string; record_id?: string } | undefined)?.id ?? (made as { record_id?: string } | undefined)?.record_id;
      if (madeId) void syncDoorsAfterWrite('bearbeitungsschritte', madeId, fields as Record<string, unknown>).then(r => { if (!r.ok) toast.error(r.message ? `${t('door_failed')}: ${r.message}` : t('door_failed_later')); });
      data.fetchAll();
    }
  }

  const surfaces = (
    <>
      <EinreichendePersonenDialog
        open={einreichendePersonenDialog !== null}
        onClose={() => setEinreichendePersonenDialog(null)}
        onSubmit={submitEinreichendePersonen}
        defaultValues={einreichendePersonenDialog?.defaults}
        recordId={einreichendePersonenDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['EinreichendePersonen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['EinreichendePersonen']}
      />
      <ErfindungsmeldungenDialog
        open={erfindungsmeldungenDialog !== null}
        onClose={() => setErfindungsmeldungenDialog(null)}
        onSubmit={submitErfindungsmeldungen}
        defaultValues={erfindungsmeldungenDialog?.defaults}
        recordId={erfindungsmeldungenDialog?.editing?.record_id}
        einreichendePersonenList={data.einreichendePersonen}
        enablePhotoScan={AI_PHOTO_SCAN['Erfindungsmeldungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Erfindungsmeldungen']}
      />
      <BearbeitungsschritteDialog
        open={bearbeitungsschritteDialog !== null}
        onClose={() => setBearbeitungsschritteDialog(null)}
        onSubmit={submitBearbeitungsschritte}
        defaultValues={bearbeitungsschritteDialog?.defaults}
        recordId={bearbeitungsschritteDialog?.editing?.record_id}
        erfindungsmeldungenList={data.erfindungsmeldungen}
        enablePhotoScan={AI_PHOTO_SCAN['Bearbeitungsschritte']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Bearbeitungsschritte']}
      />
      <RecordOverlayHost
        overlay={overlay}
        placement={options?.placement}
        size={options?.size}
        footer={options?.footer}
        render={(top) => {
          if (top.type === 'einreichendePersonen') {
            return (
              <>
                <RecordHeader title={displayNameOf('einreichende_personen', top.record.fields as Record<string, unknown>) || appLabel('einreichende_personen')} subtitle={undefined} />
                <EinreichendePersonenDetails
                  record={top.record}
                  erfindungsmeldungenList={data.erfindungsmeldungen}
                  onOpenErfindungsmeldungen={(r) => detailErfindungsmeldungen(r, true)}
                  onAddErfindungsmeldungen={perms.canWrite('erfindungsmeldungen') ? () => setErfindungsmeldungenDialog({ defaults: { einreichende_person: createRecordUrl(APP_IDS.EINREICHENDE_PERSONEN, top.record.record_id) } }) : undefined}
                />
              </>
            );
          }
          if (top.type === 'erfindungsmeldungen') {
            return (
              <>
                <RecordHeader title={displayNameOf('erfindungsmeldungen', top.record.fields as Record<string, unknown>) || appLabel('erfindungsmeldungen')} subtitle={top.record.fields.fertigstellung ? formatDate(top.record.fields.fertigstellung) : undefined} />
                <ErfindungsmeldungenDetails
                  record={top.record}
                  einreichendePersonenList={data.einreichendePersonen}
                  onOpenEinreichendePersonen={(r) => detailEinreichendePersonen(r, true)}
                  bearbeitungsschritteList={data.bearbeitungsschritte}
                  onOpenBearbeitungsschritte={(r) => detailBearbeitungsschritte(r, true)}
                  onAddBearbeitungsschritte={perms.canWrite('bearbeitungsschritte') ? () => setBearbeitungsschritteDialog({ defaults: { meldung: createRecordUrl(APP_IDS.ERFINDUNGSMELDUNGEN, top.record.record_id) } }) : undefined}
                />
              </>
            );
          }
          if (top.type === 'bearbeitungsschritte') {
            return (
              <>
                <RecordHeader title={displayNameOf('bearbeitungsschritte', top.record.fields as Record<string, unknown>) || appLabel('bearbeitungsschritte')} subtitle={top.record.fields.schrittdatum ? formatDate(top.record.fields.schrittdatum) : undefined} />
                <BearbeitungsschritteDetails
                  record={top.record}
                  erfindungsmeldungenList={data.erfindungsmeldungen}
                  onOpenErfindungsmeldungen={(r) => detailErfindungsmeldungen(r, true)}
                />
              </>
            );
          }
          return null;
        }}
        canEdit={(top) => {
          if (top.type === 'einreichendePersonen') return perms.canWrite('einreichende_personen');
          if (top.type === 'erfindungsmeldungen') return perms.canWrite('erfindungsmeldungen');
          if (top.type === 'bearbeitungsschritte') return perms.canWrite('bearbeitungsschritte');
          return true;
        }}
        onEdit={(top) => {
          overlay.close();
          if (top.type === 'einreichendePersonen') setEinreichendePersonenDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'erfindungsmeldungen') setErfindungsmeldungenDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'bearbeitungsschritte') setBearbeitungsschritteDialog({ editing: top.record, defaults: top.record.fields });
        }}
      />
    </>
  );

  return {
    overlay,
    surfaces,
    einreichendePersonen: {
      openCreate: (defaults?: EinreichendePersonenDialogDefaults) => (perms.canWrite('einreichende_personen') ? setEinreichendePersonenDialog({ defaults }) : refuse()),
      openEdit: (record: EinreichendePersonen) => (perms.canWrite('einreichende_personen') ? setEinreichendePersonenDialog({ editing: record, defaults: record.fields }) : refuse()),
      openDetail: (record: EinreichendePersonen) => detailEinreichendePersonen(record, false),
      canWrite: perms.canWrite('einreichende_personen'),
    },
    erfindungsmeldungen: {
      openCreate: (defaults?: ErfindungsmeldungenDialogDefaults) => (perms.canWrite('erfindungsmeldungen') ? setErfindungsmeldungenDialog({ defaults }) : refuse()),
      openEdit: (record: Erfindungsmeldungen) => (perms.canWrite('erfindungsmeldungen') ? setErfindungsmeldungenDialog({ editing: record, defaults: record.fields }) : refuse()),
      openDetail: (record: Erfindungsmeldungen) => detailErfindungsmeldungen(record, false),
      canWrite: perms.canWrite('erfindungsmeldungen'),
    },
    bearbeitungsschritte: {
      openCreate: (defaults?: BearbeitungsschritteDialogDefaults) => (perms.canWrite('bearbeitungsschritte') ? setBearbeitungsschritteDialog({ defaults }) : refuse()),
      openEdit: (record: Bearbeitungsschritte) => (perms.canWrite('bearbeitungsschritte') ? setBearbeitungsschritteDialog({ editing: record, defaults: record.fields }) : refuse()),
      openDetail: (record: Bearbeitungsschritte) => detailBearbeitungsschritte(record, false),
      canWrite: perms.canWrite('bearbeitungsschritte'),
    },
    enriched: { einreichendePersonen: data.einreichendePersonen, erfindungsmeldungen: enrichedErfindungsmeldungen, bearbeitungsschritte: enrichedBearbeitungsschritte },
  };
}
