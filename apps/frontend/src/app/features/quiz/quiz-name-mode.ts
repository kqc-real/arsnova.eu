export type QuizParticipantNameMode = 'nicknameTheme' | 'allowCustomNicknames' | 'anonymousMode';

/** Anonym gewinnt, damit eine alte Doppelauswahl nicht weiter wie »eigener Name« aussieht. */
export function quizParticipantNameMode(flags: {
  allowCustomNicknames: boolean;
  anonymousMode: boolean;
}): QuizParticipantNameMode {
  if (flags.anonymousMode) return 'anonymousMode';
  if (flags.allowCustomNicknames) return 'allowCustomNicknames';
  return 'nicknameTheme';
}

export function quizParticipantNameFlags(mode: QuizParticipantNameMode): {
  allowCustomNicknames: boolean;
  anonymousMode: boolean;
} {
  return {
    allowCustomNicknames: mode === 'allowCustomNicknames',
    anonymousMode: mode === 'anonymousMode',
  };
}
