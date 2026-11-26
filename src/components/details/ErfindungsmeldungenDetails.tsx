import type { Erfindungsmeldungen, EinreichendePersonen, Bearbeitungsschritte } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';
import { usePermissions } from '@/lib/permissions';
import { displayNameOf, displayPart } from '@/lib/journey/rules';

export interface ErfindungsmeldungenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Erfindungsmeldungen;
  /** N:1-Ziel „EinreichendePersonen": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  einreichendePersonenList: EinreichendePersonen[];
  /** Klick auf die EinreichendePersonen-Relation → overlay.push auf dessen Detail. */
  onOpenEinreichendePersonen?: (record: EinreichendePersonen) => void;
  /** 1:N „Bearbeitungsschritte" (meldung): VOLLE Liste — der Block filtert auf diesen Record. */
  bearbeitungsschritteList: Bearbeitungsschritte[];
  /** Zeilen-Klick → overlay.push auf das Bearbeitungsschritte-Detail (nie der Edit-Dialog). */
  onOpenBearbeitungsschritte: (record: Bearbeitungsschritte) => void;
  /** Kontextuelles „+": öffnet den Bearbeitungsschritte-Dialog mit diesem Record vorgesetzt. */
  onAddBearbeitungsschritte?: () => void;
}

export function ErfindungsmeldungenDetails({
  record,
  einreichendePersonenList,
  onOpenEinreichendePersonen,
  bearbeitungsschritteList,
  onOpenBearbeitungsschritte,
  onAddBearbeitungsschritte,
}: ErfindungsmeldungenDetailsProps) {
  // attachments are a write to this record — read-only without the platform right
  const perms = usePermissions();
  const einreichende_personTarget = einreichendePersonenList.find(r => r.record_id === extractRecordId(record.fields.einreichende_person));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('erfindungsmeldungen', 'melder_vorname')} value={record.fields.melder_vorname} format="text" />
        <RecordField label={fieldLabel('erfindungsmeldungen', 'melder_nachname')} value={record.fields.melder_nachname} format="text" />
        <RecordField label={fieldLabel('erfindungsmeldungen', 'melder_email')} value={record.fields.melder_email} format="email" />
        <RecordField label={fieldLabel('erfindungsmeldungen', 'melder_telefon')} value={record.fields.melder_telefon} format="text" />
        <RecordField label={fieldLabel('erfindungsmeldungen', 'abteilung')} value={record.fields.abteilung} format="text" />
        <RecordField label={fieldLabel('erfindungsmeldungen', 'erfindungsart')} value={record.fields.erfindungsart} format="pill" />
        <RecordField label={fieldLabel('erfindungsmeldungen', 'titel')} value={record.fields.titel} format="text" />
        <RecordField label={fieldLabel('erfindungsmeldungen', 'technisches_gebiet')} value={record.fields.technisches_gebiet} format="text" />
        <RecordField label={fieldLabel('erfindungsmeldungen', 'problem')} value={record.fields.problem} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('erfindungsmeldungen', 'loesung')} value={record.fields.loesung} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('erfindungsmeldungen', 'vorteile')} value={record.fields.vorteile} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('erfindungsmeldungen', 'fertigstellung')} value={record.fields.fertigstellung} format="date" />
        <RecordField label={fieldLabel('erfindungsmeldungen', 'miterfinder')} value={record.fields.miterfinder} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('erfindungsmeldungen', 'betriebliche_mittel')} value={record.fields.betriebliche_mittel} format="bool" />
        <RecordField label={fieldLabel('erfindungsmeldungen', 'mittel_beschreibung')} value={record.fields.mittel_beschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('erfindungsmeldungen', 'meldedatum')} value={record.fields.meldedatum} format="date" />
        <RecordField label={fieldLabel('erfindungsmeldungen', 'status')} value={record.fields.status} format="pill" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={1}>
        <RecordRelation
          label={fieldLabel('erfindungsmeldungen', 'einreichende_person')}
          name={einreichende_personTarget ? (displayNameOf('einreichende_personen', einreichende_personTarget.fields as Record<string, unknown>) || '—') : '—'}
          meta={[einreichende_personTarget?.fields.email, einreichende_personTarget?.fields.telefon].filter(Boolean).join(' · ') || undefined}
          onClick={einreichende_personTarget && onOpenEinreichendePersonen ? () => onOpenEinreichendePersonen!(einreichende_personTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title={appLabel('bearbeitungsschritte')}
        items={bearbeitungsschritteList.filter(r => extractRecordId(r.fields.meldung) === record.record_id)}
        map={r => ({ name: displayNameOf('bearbeitungsschritte', r.fields as Record<string, unknown>) || appLabel('bearbeitungsschritte'), meta: displayPart(r.fields.schrittdatum) })}
        onOpen={onOpenBearbeitungsschritte}
        onAdd={onAddBearbeitungsschritte}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.ERFINDUNGSMELDUNGEN} recordId={record.record_id} readOnly={!perms.canWrite('erfindungsmeldungen')} />
    </>
  );
}
