import type { Bearbeitungsschritte, Erfindungsmeldungen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { usePermissions } from '@/lib/permissions';
import { displayNameOf } from '@/lib/journey/rules';

export interface BearbeitungsschritteDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Bearbeitungsschritte;
  /** N:1-Ziel „Erfindungsmeldungen": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  erfindungsmeldungenList: Erfindungsmeldungen[];
  /** Klick auf die Erfindungsmeldungen-Relation → overlay.push auf dessen Detail. */
  onOpenErfindungsmeldungen?: (record: Erfindungsmeldungen) => void;
}

export function BearbeitungsschritteDetails({
  record,
  erfindungsmeldungenList,
  onOpenErfindungsmeldungen,
}: BearbeitungsschritteDetailsProps) {
  // attachments are a write to this record — read-only without the platform right
  const perms = usePermissions();
  const meldungTarget = erfindungsmeldungenList.find(r => r.record_id === extractRecordId(record.fields.meldung));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('bearbeitungsschritte', 'schrittart')} value={record.fields.schrittart} format="pill" />
        <RecordField label={fieldLabel('bearbeitungsschritte', 'schrittdatum')} value={record.fields.schrittdatum} format="date" />
        <RecordField label={fieldLabel('bearbeitungsschritte', 'bearbeiter_vorname')} value={record.fields.bearbeiter_vorname} format="text" />
        <RecordField label={fieldLabel('bearbeitungsschritte', 'bearbeiter_nachname')} value={record.fields.bearbeiter_nachname} format="text" />
        <RecordField label={fieldLabel('bearbeitungsschritte', 'schrittstatus')} value={record.fields.schrittstatus} format="pill" />
        <RecordField label={fieldLabel('bearbeitungsschritte', 'notiz')} value={record.fields.notiz} format="longtext" className="md:col-span-2" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={1}>
        <RecordRelation
          label={fieldLabel('bearbeitungsschritte', 'meldung')}
          name={meldungTarget ? (displayNameOf('erfindungsmeldungen', meldungTarget.fields as Record<string, unknown>) || '—') : '—'}
          meta={[meldungTarget?.fields.melder_email, meldungTarget?.fields.melder_telefon].filter(Boolean).join(' · ') || undefined}
          onClick={meldungTarget && onOpenErfindungsmeldungen ? () => onOpenErfindungsmeldungen!(meldungTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.BEARBEITUNGSSCHRITTE} recordId={record.record_id} readOnly={!perms.canWrite('bearbeitungsschritte')} />
    </>
  );
}
