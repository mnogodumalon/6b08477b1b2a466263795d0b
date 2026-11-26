/**
 * Meldung bearbeiten — 3-Schritt-Wizard + Prüfen.
 * Steps: 1) Offene Meldung wählen → 2) Bearbeitungsschritt dokumentieren → 3) Neuen Status wählen → 4) Prüfen & speichern.
 * Reads: erfindungsmeldungen. Writes: bearbeitungsschritte (create), erfindungsmeldungen (update status).
 * Composes: IntentWizardShell, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldLookup, fieldDate } from '@/lib/journey';
import { useMeldungBearbeitenFlow } from '@/lib/journey/flows/MeldungBearbeiten';
import { tx } from '@/i18n';

export default function MeldungBearbeitenPage() {
  const [step, setStep] = useState(1);
  const flow = useMeldungBearbeitenFlow({
    steps: {
      erfindungsmeldungen: 1, meldung: 1,
      schrittart: 2, bearbeiter_vorname: 2, bearbeiter_nachname: 2, schrittstatus: 2, notiz: 2,
      status: 3,
    },
    items: {
      erfindungsmeldungen: r => ({
        id: r.id,
        title: fieldText(r, 'titel'),
        subtitle: [fieldText(r, 'melder_nachname'), fieldDate(r, 'meldedatum')].filter(Boolean).join(' · '),
        status: fieldLookup(r, 'status') ?? undefined,
      }),
    },
    where: {
      meldung: r => ['eingegangen', 'in_pruefung'].includes(fieldLookup(r, 'status')?.key ?? ''),
      erfindungsmeldungen: r => {
        const key = fieldLookup(r, 'status')?.key;
        return !key || key === 'eingegangen' || key === 'in_pruefung';
      },
    },
  });

  return (
    <IntentWizardShell
      title={tx('Meldung bearbeiten')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Einen Bearbeitungsschritt dokumentieren und den Status der Meldung setzen.'),
        needs: [tx('Eine eingegangene Meldung'), tx('Name des Bearbeiters')],
      }}
    >
      <WizardStep label={tx('Meldung')} description={tx('Welche offene Meldung bearbeitest du?')}>
        <EntitySelectStep
          {...flow.picks.erfindungsmeldungen.select}
          {...flow.pick('erfindungsmeldungen')}
          onSelect={id => {
            flow.pick('erfindungsmeldungen').onSelect(id);
            flow.forms.bearbeitungsschritte.set('meldung', id, flow.picks.erfindungsmeldungen.labelOf(id) ?? id);
          }}
          searchPlaceholder={tx('Titel oder Name des Melders …')}
          emptyText={tx('Keine Meldung ist eingegangen oder in Prüfung.')}
        />
      </WizardStep>
      <WizardStep label={tx('Bearbeitungsschritt')} description={tx('Was wurde getan, und von wem?')} needs={['erfindungsmeldungen']}>
        <div className="space-y-4">
          <Bound form={flow.forms.bearbeitungsschritte} name="schrittart" />
          <Bound form={flow.forms.bearbeitungsschritte} name="bearbeiter_vorname" />
          <Bound form={flow.forms.bearbeitungsschritte} name="bearbeiter_nachname" />
          <Bound form={flow.forms.bearbeitungsschritte} name="schrittstatus" allowClear />
          <Bound form={flow.forms.bearbeitungsschritte} name="notiz" rows={4} />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => flow.validateStep(2)}
            nextStepLabel={tx('Neuer Status')}
          />
        </div>
      </WizardStep>
      <WizardStep label={tx('Neuer Status')} description={tx('Welchen Bearbeitungsstatus hat die Meldung jetzt?')} needs={['erfindungsmeldungen']}>
        <div className="space-y-4">
          <Bound form={flow.forms.erfindungsmeldungen} name="status" />
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => flow.validateStep(3)}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>
      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            whatHappensNext={tx('Der Bearbeitungsschritt wird protokolliert und der Status der Meldung aktualisiert.')}
          />
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          undo={flow.undo}
          actions={{ copy: false, print: false }}
          next={[
            { label: tx('Weitere Meldung bearbeiten'), onClick: () => { flow.reset(); setStep(1); } },
            { label: tx('Meldung intern erfassen'), href: '#/intents/meldung-erfassen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
