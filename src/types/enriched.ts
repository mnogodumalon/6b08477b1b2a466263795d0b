import type { Bearbeitungsschritte, Erfindungsmeldungen } from './app';

export type EnrichedErfindungsmeldungen = Erfindungsmeldungen & {
  einreichende_personName: string;
};

export type EnrichedBearbeitungsschritte = Bearbeitungsschritte & {
  meldungName: string;
};
