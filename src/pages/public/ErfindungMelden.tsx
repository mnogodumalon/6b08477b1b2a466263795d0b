import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { useStepForm, useJourneySubmit } from '@/lib/journey';
import { createPublicPort } from '@/lib/journey/publicPort';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Bound } from '@/components/blocks/Bound';
import { tx } from '@/i18n';

const SLUG = 'erfindung-melden';

function MeldeFormular({ cfg, page }: { cfg: PublicPagesConfig; page: PublicPageConfig }) {
  const [step, setStep] = useState(1);
  const port = useMemo(() => createPublicPort(cfg, page), [cfg, page]);

  const f = useStepForm('erfindungsmeldungen', {
    fields: [
      'melder_vorname', 'melder_nachname', 'melder_email', 'melder_telefon', 'abteilung',
      'erfindungsart', 'titel', 'technisches_gebiet', 'problem', 'loesung', 'vorteile',
      'fertigstellung', 'miterfinder', 'betriebliche_mittel', 'mittel_beschreibung',
    ],
    steps: {
      melder_vorname: 1, melder_nachname: 1, melder_email: 1, melder_telefon: 1, abteilung: 1,
      erfindungsart: 2, titel: 2, technisches_gebiet: 2, problem: 2, loesung: 2, vorteile: 2,
      fertigstellung: 2, miterfinder: 2, betriebliche_mittel: 2, mittel_beschreibung: 2,
    },
    autoComplete: true,
  });

  const submit = useJourneySubmit(
    port,
    [{ key: 'meldung', entity: 'erfindungsmeldungen', form: f, primary: true }],
    { draftKey: SLUG },
  );

  const steps = [
    { label: tx('Über dich') },
    { label: tx('Deine Erfindung') },
    { label: tx('Prüfen') },
  ];

  return (
    <IntentWizardShell
      steps={steps}
      currentStep={step}
      onStepChange={setStep}
      back={false}
      forms={[f]}
      draftKey={SLUG}
    >
      {step === 1 && (
        <div className="space-y-4">
          <Bound form={f} name="melder_vorname" />
          <Bound form={f} name="melder_nachname" />
          <Bound form={f} name="melder_email" />
          <Bound form={f} name="melder_telefon" />
          <Bound form={f} name="abteilung" />
          <StepNav
            hideBack
            onNext={() => f.validate(['melder_vorname', 'melder_nachname', 'melder_email'])}
            nextStepLabel={tx('Deine Erfindung')}
          />
        </div>
      )}
      {step === 2 && (
        <div className="space-y-4">
          <Bound form={f} name="erfindungsart" />
          <Bound form={f} name="titel" />
          <Bound form={f} name="technisches_gebiet" />
          <Bound form={f} name="problem" rows={4} />
          <Bound form={f} name="loesung" rows={5} />
          <Bound form={f} name="vorteile" rows={4} />
          <div role="group" data-key="fertigstellung">
            <Bound form={f} name="fertigstellung" />
          </div>
          <Bound form={f} name="miterfinder" />
          <Bound form={f} name="betriebliche_mittel" />
          <Bound form={f} name="mittel_beschreibung" rows={4} />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => f.validate(['erfindungsart', 'titel', 'loesung'])}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      )}
      {step === 3 && !submit.done && (
        <SummaryStep
          forms={[f]}
          submit={submit}
          whatHappensNext={tx('Deine Meldung geht bei uns ein und wird vom zuständigen Team geprüft.')}
        />
      )}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[f]}
          submit={submit}
          title={tx('Erfindung gemeldet')}
          whatHappensNext={tx('Vielen Dank! Wir prüfen deine Meldung und melden uns bei dir.')}
        />
      )}
    </IntentWizardShell>
  );
}

export default function ErfindungMelden() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPublicPagesConfig(SLUG)
      .then(c => {
        setCfg(c);
        setPage(c?.pages[SLUG] ?? null);
      })
      .catch(() => {
        setCfg(null);
        setPage(null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={!loading} />;
  }

  return (
    <PublicShell
      title={page.title}
      description={tx('Melde deine Erfindung — ob Diensterfindung oder freie Erfindung.')}
    >
      <MeldeFormular cfg={cfg} page={page} />
    </PublicShell>
  );
}
