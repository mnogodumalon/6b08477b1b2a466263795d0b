import { useMemo, useState } from 'react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { IconAlertTriangle, IconPlus, IconListCheck, IconUserOff } from '@tabler/icons-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { flowActionFor } from '@/config/plan';
import { countOf } from '@/config/plan';
import type { EnrichedErfindungsmeldungen } from '@/types/enriched';
import { LOOKUP_OPTIONS } from '@/types/app';
import { formatDate, lookupKey } from '@/lib/formatters';
import { tx, appLabel, dateFnsLocale } from '@/i18n';
import { useClock, gruss, namen } from '@/lib/polish';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { Button } from '@/components/ui/button';
import { KanbanWidget, type KanbanCard, type KanbanColumn, type KanbanTone } from '@/components/widgets/KanbanWidget';
import { ChartWidget, type ChartRow } from '@/components/widgets/ChartWidget';

function toneFor(status: string | undefined): KanbanTone {
  if (status === 'freigegeben') return 'success';
  if (status === 'eingegangen') return 'warning';
  if (status === 'in_pruefung' || status === 'inanspruchgenommen') return 'primary';
  return 'default';
}

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const { einreichendePersonen } = data;
  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type !== 'erfindungsmeldungen') return undefined;
      const go = flowActionFor('erfindungsmeldungen', 'status', top.record.record_id);
      return go ? { label: tx('Im Ablauf bearbeiten'), onClick: go } : undefined;
    },
  });
  const meldungen = crud.enriched.erfindungsmeldungen as EnrichedErfindungsmeldungen[];
  const schritte = crud.enriched.bearbeitungsschritte;
  const clock = useClock();
  const [onlyNoPerson, setOnlyNoPerson] = useState(false);

  const columns = (LOOKUP_OPTIONS['erfindungsmeldungen']?.['status'] ?? []).map(o => ({ key: o.key, label: o.label })) as KanbanColumn[];

  const titleOf = (m: EnrichedErfindungsmeldungen) =>
    m.fields.titel ?? ([m.fields.melder_vorname, m.fields.melder_nachname].filter(Boolean).join(' ') || tx('Ohne Titel'));
  const personOf = (m: EnrichedErfindungsmeldungen) =>
    m.einreichende_personName || [m.fields.melder_vorname, m.fields.melder_nachname].filter(Boolean).join(' ');

  const ageDays = (m: EnrichedErfindungsmeldungen) => {
    const d = m.fields.meldedatum ?? m.createdat;
    return d ? differenceInCalendarDays(clock, parseISO(d.slice(0, 10))) : 0;
  };

  const stale = useMemo(
    () => meldungen.filter(m => lookupKey(m.fields.status) === 'eingegangen' && ageDays(m) >= 7)
      .sort((a, b) => ageDays(b) - ageDays(a)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meldungen, clock],
  );
  const noPerson = meldungen.filter(m => !m.fields.einreichende_person);
  const neu = meldungen.filter(m => lookupKey(m.fields.status) === 'eingegangen');
  const openSteps = schritte.filter(s => lookupKey(s.fields.schrittstatus) !== 'erledigt');

  const cards: KanbanCard[] = meldungen
    .filter(m => !onlyNoPerson || !m.fields.einreichende_person)
    .sort((a, b) => (a.fields.meldedatum ?? '').localeCompare(b.fields.meldedatum ?? ''))
    .map(m => {
      const st = lookupKey(m.fields.status) ?? columns[0]?.key ?? '';
      const steps = schritte.filter(s => s.fields.meldung && s.fields.meldung.endsWith(m.record_id));
      const open = steps.filter(s => lookupKey(s.fields.schrittstatus) !== 'erledigt').length;
      const sub = [personOf(m), m.fields.meldedatum ? formatDate(m.fields.meldedatum) : '', steps.length > 0 ? tx`${steps.length - open}/${steps.length} Schritte` : '']
        .filter(Boolean).join(' · ');
      return { id: `meldung:${m.record_id}`, column: st, title: titleOf(m), subtitle: sub, tone: toneFor(st) };
    });

  const chartRows: ChartRow<EnrichedErfindungsmeldungen>[] = meldungen.map(m => ({ id: `meldung:${m.record_id}`, data: m }));

  const heroGo = stale[0] ? flowActionFor('erfindungsmeldungen', 'status', stale[0].record_id, 'in_pruefung') : null;

  const names = namen(neu.map(m => m.fields.melder_vorname ?? personOf(m)));
  const context = meldungen.length === 0
    ? tx('Noch keine Meldungen — sobald jemand eine Erfindung meldet, erscheint sie hier.')
    : neu.length > 0
      ? tx`${names} ${neu.length === 1 ? 'wartet' : 'warten'} auf Prüfung.`
      : tx('Alle Meldungen sind in Bearbeitung — nichts Neues eingegangen.');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground">{context}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <a href="#/intents/meldung-erfassen"><IconPlus size={16} className="shrink-0" />{tx('Meldung intern erfassen')}</a>
          </Button>
          {crud.einreichendePersonen.canWrite && (
            <Button size="sm" variant="outline" onClick={() => crud.einreichendePersonen.openCreate({})}>
              <IconPlus size={16} className="shrink-0" />{tx('Person anlegen')}
            </Button>
          )}
        </div>
      </div>

      <DashboardGrid
        variant="wide"
        hero={stale.length > 0 && heroGo ? (
          <HeroBanner
            icon={<IconAlertTriangle size={18} />}
            action={{ label: tx('Jetzt prüfen'), onClick: heroGo }}
          >
            <b>{namen(stale.map(m => titleOf(m)))}</b> {tx`seit über einer Woche unbearbeitet — ältestes Eingang vor ${ageDays(stale[0])} Tagen.`}
          </HeroBanner>
        ) : undefined}
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Offene Bearbeitungsschritte')}
              value={`${openSteps.length}/${schritte.length}`}
              icon={<IconListCheck size={16} />}
              tone={openSteps.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Ohne einreichende Person')}
              value={noPerson.length}
              icon={<IconUserOff size={16} />}
              tone={noPerson.length > 0 ? 'warning' : 'default'}
              onClick={() => setOnlyNoPerson(v => !v)}
              active={onlyNoPerson}
            />
          </StatStrip>
        }
        primary={
          <>
            <KanbanWidget
              cards={cards}
              columns={columns}
              defaultCollapsed={['abgelehnt']}
              onCardClick={card => {
                const rec = data.erfindungsmeldungen.find(m => m.record_id === card.id.split(':')[1]);
                if (rec) crud.erfindungsmeldungen.openDetail(rec);
              }}
              onAddCard={column => crud.erfindungsmeldungen.openCreate({ status: column })}
            />
          </>
        }
        aside={
          <>
            <WorkList
              title={tx('Offene Bearbeitungsschritte')}
              items={openSteps.map(s => {
                const mid = s.fields.meldung?.match(/([a-f0-9]{24})$/i)?.[1] ?? '';
                const go = mid ? flowActionFor('erfindungsmeldungen', 'status', mid) : null;
                return {
                  id: s.record_id,
                  title: s.meldungName || tx('Ohne Meldung'),
                  secondLine: (
                    <>
                      <span className="font-medium text-amber-600">{s.fields.schrittart?.label ?? tx('Schritt')}</span>
                      <span className="text-muted-foreground"> · {s.fields.schrittstatus?.label}{s.fields.schrittdatum ? ` · ${formatDate(s.fields.schrittdatum)}` : ''}</span>
                    </>
                  ),
                  action: go ? { label: tx('Bearbeiten'), onClick: go } : undefined,
                };
              })}
              onItemClick={id => {
                const rec = data.bearbeitungsschritte.find(s => s.record_id === id);
                if (rec) crud.bearbeitungsschritte.openDetail(rec);
              }}
              empty={{ text: tx('Alle Bearbeitungsschritte sind erledigt.') }}
            />
            <ChartWidget<EnrichedErfindungsmeldungen>
              title={tx('Meldungen je einreichender Person')}
              rows={chartRows}
              dimension={{ kind: 'category', accessor: r => r.data.einreichende_personName || null, label: tx('Person') }}
              footer={<>{countOf('erfindungsmeldungen', meldungen.length, appLabel('erfindungsmeldungen'))} · {countOf('einreichende_personen', einreichendePersonen.length, appLabel('einreichende_personen'))} · {format(clock, 'dd. MMMM', { locale: dateFnsLocale() })}</>}
            />
          </>
        }
      />
      {crud.surfaces}
    </div>
  );
}
