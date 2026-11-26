import type { EinreichendePersonen, Erfindungsmeldungen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';
import { usePermissions } from '@/lib/permissions';
import { displayNameOf, displayPart } from '@/lib/journey/rules';

export interface EinreichendePersonenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: EinreichendePersonen;
  /** 1:N „Erfindungsmeldungen" (einreichende_person): VOLLE Liste — der Block filtert auf diesen Record. */
  erfindungsmeldungenList: Erfindungsmeldungen[];
  /** Zeilen-Klick → overlay.push auf das Erfindungsmeldungen-Detail (nie der Edit-Dialog). */
  onOpenErfindungsmeldungen: (record: Erfindungsmeldungen) => void;
  /** Kontextuelles „+": öffnet den Erfindungsmeldungen-Dialog mit diesem Record vorgesetzt. */
  onAddErfindungsmeldungen?: () => void;
}

export function EinreichendePersonenDetails({
  record,
  erfindungsmeldungenList,
  onOpenErfindungsmeldungen,
  onAddErfindungsmeldungen,
}: EinreichendePersonenDetailsProps) {
  // attachments are a write to this record — read-only without the platform right
  const perms = usePermissions();
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('einreichende_personen', 'vorname')} value={record.fields.vorname} format="text" />
        <RecordField label={fieldLabel('einreichende_personen', 'nachname')} value={record.fields.nachname} format="text" />
        <RecordField label={fieldLabel('einreichende_personen', 'email')} value={record.fields.email} format="email" />
        <RecordField label={fieldLabel('einreichende_personen', 'telefon')} value={record.fields.telefon} format="text" />
        <RecordField label={fieldLabel('einreichende_personen', 'abteilung')} value={record.fields.abteilung} format="text" />
      </RecordSection>

      <SatelliteSection
        title={appLabel('erfindungsmeldungen')}
        items={erfindungsmeldungenList.filter(r => extractRecordId(r.fields.einreichende_person) === record.record_id)}
        map={r => ({ name: displayNameOf('erfindungsmeldungen', r.fields as Record<string, unknown>) || appLabel('erfindungsmeldungen'), meta: displayPart(r.fields.fertigstellung) })}
        onOpen={onOpenErfindungsmeldungen}
        onAdd={onAddErfindungsmeldungen}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.EINREICHENDE_PERSONEN} recordId={record.record_id} readOnly={!perms.canWrite('einreichende_personen')} />
    </>
  );
}
