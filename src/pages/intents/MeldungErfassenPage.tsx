/**
 * Meldung intern erfassen — 3-Schritt-Wizard.
 * Steps: 1) Meldende Person (Vorname, Nachname, E-Mail) → 2) Angaben zur Erfindung → 3) Prüfen & speichern.
 * Reads: —. Writes: erfindungsmeldungen (status wird vom Flow gesetzt, Verknüpfung zur Person übernimmt ein Werkzeug).
 * Composes: IntentWizardShell, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { useMeldungErfassenFlow } from '@/lib/journey/flows/MeldungErfassen';
import { tx } from '@/i18n';

export default function MeldungErfassenPage() {
  const [step, setStep] = useState(1);
  const flow = useMeldungErfassenFlow({
    steps: {
      melder_vorname: 1, melder_nachname: 1, melder_email: 1,
      erfindungsart: 2, titel: 2, technisches_gebiet: 2, problem: 2, loesung: 2, vorteile: 2,
      fertigstellung: 2, miterfinder: 2, betriebliche_mittel: 2, mittel_beschreibung: 2,
    },
  });
  const f = flow.forms.erfindungsmeldungen;

  return (
    <IntentWizardShell
      title={tx('Meldung intern erfassen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Eine schriftlich oder mündlich eingegangene Erfindungsmeldung erfassen.'),
        needs: [tx('Name und E-Mail-Adresse der meldenden Person'), tx('Beschreibung der Erfindung')],
      }}
    >
      <WizardStep label={tx('Meldende Person')} description={tx('Wer hat die Erfindung gemeldet?')}>
        <div className="space-y-4">
          <Bound form={f} name="melder_vorname" />
          <Bound form={f} name="melder_nachname" />
          <Bound form={f} name="melder_email" hint={tx('Darüber wird die meldende Person zugeordnet.')} />
          <StepNav
            hideBack
            onNext={() => f.validate(['melder_vorname', 'melder_nachname', 'melder_email'])}
            nextStepLabel={tx('Erfindung')}
          />
        </div>
      </WizardStep>
      <WizardStep label={tx('Erfindung')} description={tx('Was wurde erfunden und wie funktioniert es?')}>
        <div className="space-y-4">
          <Bound form={f} name="erfindungsart" />
          <Bound form={f} name="titel" />
          <Bound form={f} name="technisches_gebiet" />
          <Bound form={f} name="problem" rows={3} />
          <Bound form={f} name="loesung" rows={4} />
          <Bound form={f} name="vorteile" rows={3} />
          <Bound form={f} name="fertigstellung" />
          <Bound form={f} name="miterfinder" rows={2} />
          <Bound form={f} name="betriebliche_mittel" />
          <Bound form={f} name="mittel_beschreibung" rows={3} />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => f.validate(['erfindungsart', 'titel', 'loesung'])}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>
      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            variants={flow.actions}
            items={f.get('fertigstellung') ? [] : [{ key: 'fertigstellung', label: f.rules.fertigstellung?.label ?? '', value: '—', step: 2, keys: ['fertigstellung'] }]}
            whatHappensNext={tx('Die Meldung wird gespeichert. Meldedatum und Verknüpfung mit der meldenden Person setzen die Werkzeuge.')}
          />
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          next={[
            { label: tx('Meldung bearbeiten'), href: '#/intents/meldung-bearbeiten' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
