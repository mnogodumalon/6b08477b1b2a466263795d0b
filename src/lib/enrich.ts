import type { EnrichedBearbeitungsschritte, EnrichedErfindungsmeldungen } from '@/types/enriched';
import type { Bearbeitungsschritte, EinreichendePersonen, Erfindungsmeldungen } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import { displayPart } from '@/lib/journey/rules';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => displayPart(r.fields[f])).filter(Boolean).join(' ').trim();
}

interface ErfindungsmeldungenMaps {
  einreichendePersonenMap: Map<string, EinreichendePersonen>;
}

export function enrichErfindungsmeldungen(
  erfindungsmeldungen: Erfindungsmeldungen[],
  maps: ErfindungsmeldungenMaps
): EnrichedErfindungsmeldungen[] {
  return erfindungsmeldungen.map(r => ({
    ...r,
    einreichende_personName: resolveDisplay(r.fields.einreichende_person, maps.einreichendePersonenMap, 'vorname', 'nachname'),
  }));
}

interface BearbeitungsschritteMaps {
  erfindungsmeldungenMap: Map<string, Erfindungsmeldungen>;
}

export function enrichBearbeitungsschritte(
  bearbeitungsschritte: Bearbeitungsschritte[],
  maps: BearbeitungsschritteMaps
): EnrichedBearbeitungsschritte[] {
  return bearbeitungsschritte.map(r => ({
    ...r,
    meldungName: resolveDisplay(r.fields.meldung, maps.erfindungsmeldungenMap, 'titel'),
  }));
}
