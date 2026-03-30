import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums – müssen mit Prisma-Schema synchron bleiben
// ---------------------------------------------------------------------------

export const QuestionTypeEnum = z.enum([
  'MULTIPLE_CHOICE',
  'SINGLE_CHOICE',
  'FREETEXT',
  'SURVEY',
  'RATING',
]);
export type QuestionType = z.infer<typeof QuestionTypeEnum>;

export const SessionStatusEnum = z.enum([
  'LOBBY',
  'QUESTION_OPEN',
  'ACTIVE',
  'PAUSED',
  'RESULTS',
  'DISCUSSION',
  'FINISHED',
]);
export type SessionStatus = z.infer<typeof SessionStatusEnum>;

export const DifficultyEnum = z.enum(['EASY', 'MEDIUM', 'HARD']);
export type Difficulty = z.infer<typeof DifficultyEnum>;

export const NicknameThemeEnum = z.enum([
  'NOBEL_LAUREATES',
  'KINDERGARTEN',
  'PRIMARY_SCHOOL',
  'MIDDLE_SCHOOL',
  'HIGH_SCHOOL',
]);
export type NicknameTheme = z.infer<typeof NicknameThemeEnum>;

export const TeamAssignmentEnum = z.enum(['AUTO', 'MANUAL']);
export type TeamAssignment = z.infer<typeof TeamAssignmentEnum>;

export const TeamNamesSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(8)
  .superRefine((names, ctx) => {
    const seen = new Set<string>();
    for (const [index, name] of names.entries()) {
      const normalized = name.trim().toLocaleLowerCase();
      if (seen.has(normalized)) {
        ctx.addIssue({
          code: 'custom',
          path: [index],
          message: 'Team-Namen müssen eindeutig sein.',
        });
      }
      seen.add(normalized);
    }
  });
export type TeamNames = z.infer<typeof TeamNamesSchema>;

export const QaQuestionStatusEnum = z.enum(['PENDING', 'ACTIVE', 'PINNED', 'ARCHIVED', 'DELETED']);
export type QaQuestionStatus = z.infer<typeof QaQuestionStatusEnum>;

export const SessionTypeEnum = z.enum(['QUIZ', 'Q_AND_A']);
export type SessionType = z.infer<typeof SessionTypeEnum>;

/** Quiz-Presets für Schnellkonfiguration (Story 1.11) */
export const QuizPresetEnum = z.enum(['PLAYFUL', 'SERIOUS']);
export type QuizPreset = z.infer<typeof QuizPresetEnum>;

/** Multiplikatoren für die Punkteberechnung pro Schwierigkeitsgrad */
export const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  EASY: 1,
  MEDIUM: 2,
  HARD: 3,
};

/** Maximale Basispunkte pro Frage (vor Multiplikator) */
export const MAX_BASE_POINTS = 1000;

/** Streak-Multiplikatoren für aufeinanderfolgende richtige Antworten (Story 5.5) */
export const STREAK_MULTIPLIER: Record<number, number> = {
  0: 1.0,
  1: 1.0,
  2: 1.1,
  3: 1.2,
  4: 1.3,
};
/** Ab 5+ Streak gilt dieser Maximal-Multiplikator */
export const STREAK_MULTIPLIER_MAX = 1.5;

/** Verfügbare Emoji-Reaktionen (Story 5.8) */
export const EMOJI_REACTIONS = ['👏', '🎉', '😮', '😂', '😢'] as const;
export type EmojiReaction = (typeof EMOJI_REACTIONS)[number];

// ---------------------------------------------------------------------------
// Defaults – zentrale Konstanten für Quiz-Einstellungen
// ---------------------------------------------------------------------------
export const DEFAULT_TEAM_COUNT = 2;
export const DEFAULT_BONUS_TOKEN_COUNT = 3;
export const DEFAULT_TIMER_SECONDS = 60;

/** Obergrenze Motivbild-URL (typische Bild-URLs; lange signierte CDN-Links bleiben i. d. R. darunter). */
export const MOTIF_IMAGE_URL_MAX_LENGTH = 1024;

/**
 * Optionales Quiz-Motivbild (Host, Quiz-Kanal): HTTPS-URL oder root-relativer Pfad
 * (z. B. `/assets/demo/bild.svg` für gebündelte Angular-Assets).
 */
export const MotifImageUrlSchema = z
  .string()
  .max(MOTIF_IMAGE_URL_MAX_LENGTH)
  .superRefine((val, ctx) => {
    if (val.startsWith('/')) {
      if (val.startsWith('//') || val.includes('..') || val.includes('\\') || /\s/.test(val)) {
        ctx.addIssue({ code: 'custom', message: 'Ungültiger relativer Bildpfad.' });
        return;
      }
      if (!/^\/[a-zA-Z0-9/_\-.%+]+$/.test(val)) {
        ctx.addIssue({ code: 'custom', message: 'Ungültiger relativer Bildpfad.' });
      }
      return;
    }
    try {
      const u = new URL(val);
      if (u.protocol !== 'https:') {
        ctx.addIssue({
          code: 'custom',
          message: 'Nur HTTPS-URLs sind erlaubt.',
        });
      }
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Ungültige Bild-URL.' });
    }
  });

/** Leerstring / null / undefined → null; sonst gültige HTTPS-URL. */
export const QuizMotifImageUrlInputSchema = z
  .union([z.literal(''), MotifImageUrlSchema, z.null()])
  .optional()
  .transform((v) => (v === '' || v === undefined ? null : v));

// ---------------------------------------------------------------------------
// Quiz-Schemas (Zod) – werden in Backend (Validierung) & Frontend (Forms) genutzt
// ---------------------------------------------------------------------------

/** Schema für die Erstellung eines neuen Quizzes */
export const CreateQuizInputSchema = z.object({
  name: z.string().min(1, { error: 'Quiz-Name darf nicht leer sein' }).max(200),
  description: z.string().max(5000).optional(),
  motifImageUrl: QuizMotifImageUrlInputSchema,
  showLeaderboard: z.boolean().optional().default(true),
  allowCustomNicknames: z.boolean().optional().default(true),
  defaultTimer: z.number().int().min(5).max(300).nullable().optional(),
  enableSoundEffects: z.boolean().optional().default(true),
  enableRewardEffects: z.boolean().optional().default(true),
  enableMotivationMessages: z.boolean().optional().default(true),
  enableEmojiReactions: z.boolean().optional().default(true),
  anonymousMode: z.boolean().optional().default(false),
  teamMode: z.boolean().optional().default(false),
  teamCount: z.number().int().min(2).max(8).optional().default(DEFAULT_TEAM_COUNT),
  teamAssignment: TeamAssignmentEnum.optional().default('AUTO'),
  teamNames: TeamNamesSchema.optional().default([]),
  backgroundMusic: z.string().max(50).nullable().optional().default(null),
  nicknameTheme: NicknameThemeEnum.optional().default('NOBEL_LAUREATES'),
  bonusTokenCount: z.number().int().min(1).max(50).nullable().optional().default(null), // Story 4.6
  readingPhaseEnabled: z.boolean().optional().default(true),
  preset: QuizPresetEnum.optional().default('PLAYFUL'),
});
export type CreateQuizInput = z.infer<typeof CreateQuizInputSchema>;

/** Schema für eine einzelne Antwortoption beim Hinzufügen/Bearbeiten */
export const AnswerOptionInputSchema = z.object({
  text: z.string().min(1, { error: 'Antworttext darf nicht leer sein' }).max(500),
  isCorrect: z.boolean(),
});
export type AnswerOptionInput = z.infer<typeof AnswerOptionInputSchema>;

/** Schema für das Hinzufügen/Bearbeiten einer Frage (Story 1.2a, 1.2b, 1.3) */
export const AddQuestionInputSchema = z.object({
  text: z.string().min(1, { error: 'Fragenstamm darf nicht leer sein' }).max(2000),
  type: QuestionTypeEnum,
  timer: z.number().int().min(5).max(300).nullable().optional(),
  difficulty: DifficultyEnum.optional().default('MEDIUM'),
  order: z.number().int().min(0),
  answers: z.array(AnswerOptionInputSchema).max(10),
  ratingMin: z.number().int().min(0).max(10).optional(), // Nur bei RATING
  ratingMax: z.number().int().min(1).max(10).optional(), // Nur bei RATING
  ratingLabelMin: z.string().max(50).optional(), // Nur bei RATING
  ratingLabelMax: z.string().max(50).optional(), // Nur bei RATING
});
export type AddQuestionInput = z.infer<typeof AddQuestionInputSchema>;

/** Schema für den Quiz-Upload beim Live-Schalten (Story 2.1a) */
export const QuizUploadInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  /** Wie CreateQuiz: Leerstring/undefined → null (vermeidet Upload-Fehler bei leerem Feld). */
  motifImageUrl: QuizMotifImageUrlInputSchema,
  showLeaderboard: z.boolean(),
  allowCustomNicknames: z.boolean(),
  defaultTimer: z.number().int().min(5).max(300).nullable().optional(),
  enableSoundEffects: z.boolean(),
  enableRewardEffects: z.boolean(),
  enableMotivationMessages: z.boolean(),
  enableEmojiReactions: z.boolean(),
  anonymousMode: z.boolean(),
  teamMode: z.boolean(),
  teamCount: z.number().int().min(2).max(8).nullable().optional(),
  teamAssignment: TeamAssignmentEnum.optional(),
  teamNames: TeamNamesSchema.optional(),
  backgroundMusic: z.string().max(50).nullable().optional(),
  nicknameTheme: NicknameThemeEnum,
  bonusTokenCount: z.number().int().min(1).max(50).nullable().optional(), // Story 4.6
  readingPhaseEnabled: z.boolean().optional(),
  preset: QuizPresetEnum.optional(),
  questions: z
    .array(AddQuestionInputSchema)
    .min(1, { error: 'Mindestens eine Frage erforderlich' }),
});
export type QuizUploadInput = z.infer<typeof QuizUploadInputSchema>;

/** Output: Antwort auf quiz.upload (Story 2.1a). */
export const QuizUploadOutputSchema = z.object({
  quizId: z.string().uuid(),
});
export type QuizUploadOutput = z.infer<typeof QuizUploadOutputSchema>;

// ---------------------------------------------------------------------------
// Session-Schemas (Story 2.1–2.3)
// ---------------------------------------------------------------------------

/** Input: Eine neue Live-Session starten */
export const CreateSessionInputSchema = z
  .object({
    type: SessionTypeEnum.optional().default('QUIZ'), // Story 8.1: Quiz oder Q&A
    quizId: z.uuid().optional(), // Pflicht bei QUIZ, null bei Q_AND_A
    title: z.string().trim().max(200).optional(), // Story 8.1: Titel für Q&A-Runde
    moderationMode: z.boolean().optional().default(true), // Story 8.4 / Q&A: Vorab-Moderation (Default an)
    qaEnabled: z.boolean().optional().default(false), // ADR-0009: Q&A-Kanal in Quiz-Session
    qaTitle: z.string().trim().max(200).optional(), // ADR-0009: Titel des Q&A-Tabs
    qaModerationMode: z.boolean().optional().default(true), // ADR-0009: Q&A-Vorab-Moderation (Default an)
    quickFeedbackEnabled: z.boolean().optional().default(false), // ADR-0009: Blitz-Feedback-Kanal
  })
  .superRefine((value, ctx) => {
    const isQuickFeedbackOnlySession =
      value.type === 'QUIZ' &&
      !value.quizId &&
      value.qaEnabled !== true &&
      value.quickFeedbackEnabled === true;

    if (value.type === 'QUIZ' && !value.quizId && !isQuickFeedbackOnlySession) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quizId'],
        message: 'Für Quiz-Sessions ist eine quizId erforderlich.',
      });
    }

    if (value.type === 'Q_AND_A' && value.quizId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quizId'],
        message: 'Q&A-Sessions dürfen keine quizId enthalten.',
      });
    }
  });
export type CreateSessionInput = z.infer<typeof CreateSessionInputSchema>;

/** Output: Antwort auf session.create (Story 2.1a). */
export const CreateSessionOutputSchema = z.object({
  sessionId: z.uuid(),
  code: z.string().length(6),
  status: SessionStatusEnum,
  quizName: z.string().nullable(),
});
export type CreateSessionOutput = z.infer<typeof CreateSessionOutputSchema>;

/** Input: Session-Info abfragen (z. B. vor Beitritt) */
export const GetSessionInfoInputSchema = z.object({
  code: z.string().length(6, { error: 'Session-Code muss 6 Zeichen lang sein' }),
});
export type GetSessionInfoInput = z.infer<typeof GetSessionInfoInputSchema>;

/** Input: Preset zur Laufzeit ändern (Host → alle Clients). */
export const UpdateSessionPresetInputSchema = z.object({
  code: z.string().length(6),
  preset: QuizPresetEnum,
});
export type UpdateSessionPresetInput = z.infer<typeof UpdateSessionPresetInputSchema>;

/** Input: Q&A-Kanaltitel zur Laufzeit setzen (Host, ADR-0009). */
export const UpdateSessionQaTitleInputSchema = z.object({
  code: z.string().length(6),
  /** Leer oder weglassen → in der DB null (Anzeige-Default im Client). */
  qaTitle: z.string().trim().max(200).optional(),
});
export type UpdateSessionQaTitleInput = z.infer<typeof UpdateSessionQaTitleInputSchema>;

export const UpdateSessionQaTitleOutputSchema = z.object({
  qaTitle: z.string().nullable(),
  title: z.string().nullable(),
});
export type UpdateSessionQaTitleOutput = z.infer<typeof UpdateSessionQaTitleOutputSchema>;

/** Output: Status-Update nach nextQuestion / revealAnswers / revealResults (Story 2.3, 3.5). */
export const SessionStatusUpdateSchema = z.object({
  status: SessionStatusEnum,
  currentQuestion: z.number().int().min(0).nullable(),
  /** Server-Zeitstempel bei Wechsel zu ACTIVE (ISO-8601). Für Countdown-Synchronisation (Story 3.5). */
  activeAt: z.string().optional(),
  preset: QuizPresetEnum.optional(),
  /** Aktuelle Runde bei Peer Instruction (Story 2.7), 1 oder 2. */
  currentRound: z.number().int().min(1).max(2).optional(),
});
export type SessionStatusUpdate = z.infer<typeof SessionStatusUpdateSchema>;

/** DTO: Stimmenverteilung einer Runde pro Antwortoption (Story 2.7 Peer Instruction). */
export const RoundDistributionEntrySchema = z.object({
  id: z.uuid(),
  text: z.string(),
  isCorrect: z.boolean(),
  voteCount: z.number().int(),
  votePercentage: z.number().int(),
});
export type RoundDistributionEntry = z.infer<typeof RoundDistributionEntrySchema>;

/** DTO: Einzelne Wählerwanderung (von Option X nach Option Y). */
export const VoterMigrationEntrySchema = z.object({
  from: z.string(),
  to: z.string(),
  count: z.number().int(),
});
export type VoterMigrationEntry = z.infer<typeof VoterMigrationEntrySchema>;

/** DTO: Meinungswechsel-Metriken bei Peer Instruction (Story 2.7). */
export const OpinionShiftSchema = z.object({
  bothRoundsCount: z.number().int(),
  changedCount: z.number().int(),
  changedPercentage: z.number().int(),
  wrongToCorrectCount: z.number().int().optional(),
  correctToWrongCount: z.number().int().optional(),
  migrations: z.array(VoterMigrationEntrySchema).optional(),
});
export type OpinionShift = z.infer<typeof OpinionShiftSchema>;

/** DTO: Vorher/Nachher-Vergleich bei Peer Instruction (Story 2.7). */
export const RoundComparisonDTOSchema = z.object({
  round1Total: z.number().int(),
  round2Total: z.number().int(),
  round1Distribution: z.array(RoundDistributionEntrySchema),
  round2Distribution: z.array(RoundDistributionEntrySchema),
  round1CorrectCount: z.number().int().optional(),
  round2CorrectCount: z.number().int().optional(),
  opinionShift: OpinionShiftSchema.optional(),
});
export type RoundComparisonDTO = z.infer<typeof RoundComparisonDTOSchema>;

/** DTO: Aktuelle Frage für Host-Ansicht (Story 2.3, 3.5) – Text + Antwortoptionen inkl. isCorrect + Timer. */
export const HostCurrentQuestionDTOSchema = z.object({
  questionId: z.string().uuid(),
  order: z.number().int().min(0),
  /** Gesamtanzahl Fragen im Quiz (für Host-Button „Nächste Frage“ vs. „Session beenden“). */
  totalQuestions: z.number().int().min(1).optional(),
  text: z.string(),
  type: QuestionTypeEnum,
  timer: z.number().nullable().optional(),
  answers: z.array(
    z.object({
      id: z.uuid(),
      text: z.string(),
      isCorrect: z.boolean(),
    }),
  ),
  ratingMin: z.number().nullable().optional(),
  ratingMax: z.number().nullable().optional(),
  ratingLabelMin: z.string().nullable().optional(),
  ratingLabelMax: z.string().nullable().optional(),
  ratingAvg: z.number().nullable().optional(),
  ratingCount: z.number().int().optional(),
  ratingDistribution: z.record(z.string(), z.number()).optional(),
  freeTextResponses: z.array(z.string()).optional(),
  voteDistribution: z
    .array(
      z.object({
        id: z.uuid(),
        text: z.string(),
        isCorrect: z.boolean(),
        voteCount: z.number().int(),
        votePercentage: z.number().int(),
      }),
    )
    .optional(),
  totalVotes: z.number().int().optional(),
  correctVoterCount: z.number().int().optional(),
  currentRound: z.number().int().min(1).max(2).optional(),
  roundComparison: RoundComparisonDTOSchema.optional(),
});
export type HostCurrentQuestionDTO = z.infer<typeof HostCurrentQuestionDTOSchema>;

/** Input: Einer Session beitreten (Story 3.1) */
export const JoinSessionInputSchema = z.object({
  code: z.string().length(6, { error: 'Session-Code muss 6 Zeichen lang sein' }),
  nickname: z.string().min(1).max(30),
  teamId: z.uuid().optional(),
});
export type JoinSessionInput = z.infer<typeof JoinSessionInputSchema>;

// ---------------------------------------------------------------------------
// Vote-Schemas (Story 3.3)
// ---------------------------------------------------------------------------

/** Input: Abstimmung abgeben */
export const SubmitVoteInputSchema = z.object({
  sessionId: z.uuid(),
  participantId: z.uuid(), // Vom Join-Response (Story 0.5: Rate-Limit pro Participant)
  questionId: z.uuid(),
  answerIds: z.array(z.uuid()).optional(), // MC: mehrere, SC: eine, FREETEXT/RATING: keine
  freeText: z.string().max(500).optional(),
  ratingValue: z.number().int().min(0).max(10).optional(), // Nur bei RATING
  responseTimeMs: z.number().int().min(0).optional(), // Antwortzeit in ms
  round: z.number().int().min(1).max(2).optional().default(1), // Story 2.7: Peer Instruction Runde
});
export type SubmitVoteInput = z.infer<typeof SubmitVoteInputSchema>;

/** Output: Antwort auf vote.submit (Story 3.3b). */
export const SubmitVoteOutputSchema = z.object({
  voteId: z.uuid(),
});
export type SubmitVoteOutput = z.infer<typeof SubmitVoteOutputSchema>;

// ---------------------------------------------------------------------------
// DTOs – Sichere Antwort-Objekte für den Client (Data-Stripping!)
// ---------------------------------------------------------------------------

/**
 * DTO: Antwort-Option OHNE isCorrect (Story 2.4 / Security).
 * WIRD an Studenten gesendet – enthält bewusst kein `isCorrect`!
 * .strict() sorgt dafür, dass Payloads mit isCorrect die Validierung fehlschlagen (nicht nur strippen).
 */
export const AnswerOptionStudentDTOSchema = z
  .object({
    id: z.uuid(),
    text: z.string(),
  })
  .strict();
export type AnswerOptionStudentDTO = z.infer<typeof AnswerOptionStudentDTOSchema>;

/**
 * DTO: Antwort-Option MIT isCorrect (Story 3.4 / Ergebnis-Phase).
 * Wird erst NACH Auflösung durch den Dozenten (Status RESULTS) gesendet!
 */
export const AnswerOptionRevealedDTOSchema = z.object({
  id: z.uuid(),
  text: z.string(),
  isCorrect: z.boolean(),
  voteCount: z.number(), // Anzahl Votes für diese Option
  votePercentage: z.number(), // Prozentualer Anteil (0–100)
});
export type AnswerOptionRevealedDTO = z.infer<typeof AnswerOptionRevealedDTOSchema>;

/** DTO: Frage mit aufgelösten Ergebnissen (Story 3.4, 4.4) */
export const QuestionRevealedDTOSchema = z.object({
  id: z.uuid(),
  text: z.string(),
  type: QuestionTypeEnum,
  difficulty: DifficultyEnum,
  order: z.number(),
  /** Gesamtanzahl Fragen (für Client-Hinweis „Letzte Frage“). */
  totalQuestions: z.number().int().min(1).optional(),
  answers: z.array(AnswerOptionRevealedDTOSchema),
  freeTextResponses: z.array(z.string()).optional(), // Nur bei FREETEXT-Fragen
  totalVotes: z.number(),
});
export type QuestionRevealedDTO = z.infer<typeof QuestionRevealedDTOSchema>;

/** DTO: Frage für Studenten (ohne Lösung). activeAt = Server-Zeitpunkt bei ACTIVE-Wechsel (Countdown-Sync, Story 3.5). Optional participantCount/totalVotes für Anzeige „Alle haben abgestimmt“ und Countdown-Ausblendung. */
export const QuestionStudentDTOSchema = z.object({
  id: z.uuid(),
  text: z.string(),
  type: QuestionTypeEnum,
  timer: z.number().nullable(),
  difficulty: DifficultyEnum,
  order: z.number(),
  /** Gesamtanzahl Fragen (für Client-Hinweis „Letzte Frage“). */
  totalQuestions: z.number().int().min(1).optional(),
  answers: z.array(AnswerOptionStudentDTOSchema),
  activeAt: z.string().optional(),
  ratingMin: z.number().nullable().optional(),
  ratingMax: z.number().nullable().optional(),
  ratingLabelMin: z.string().nullable().optional(),
  ratingLabelMax: z.string().nullable().optional(),
  participantCount: z.number().int().min(0).optional(),
  totalVotes: z.number().int().min(0).optional(),
  currentRound: z.number().int().min(1).max(2).optional(),
});
export type QuestionStudentDTO = z.infer<typeof QuestionStudentDTOSchema>;

/**
 * DTO: Frage in der Lesephase – NUR Fragenstamm, KEINE Antwortoptionen (Story 2.6).
 * Wird im Status QUESTION_OPEN an alle Clients gesendet.
 * Der Dozent gibt erst danach die Antworten frei (→ ACTIVE + QuestionStudentDTO).
 */
export const QuestionPreviewDTOSchema = z.object({
  id: z.uuid(),
  text: z.string(),
  type: QuestionTypeEnum,
  difficulty: DifficultyEnum,
  order: z.number(),
  /** Gesamtanzahl Fragen (für Client-Hinweis „Letzte Frage“). */
  totalQuestions: z.number().int().min(1).optional(),
  ratingMin: z.number().nullable().optional(), // Nur bei RATING
  ratingMax: z.number().nullable().optional(), // Nur bei RATING
  ratingLabelMin: z.string().nullable().optional(), // Nur bei RATING
  ratingLabelMax: z.string().nullable().optional(), // Nur bei RATING
});
export type QuestionPreviewDTO = z.infer<typeof QuestionPreviewDTOSchema>;

/** DTO: Session-Info für den Beitritt (Story 3.1, 3.2). Enthält Nickname-Konfiguration bei QUIZ. */
export const SessionChannelsDTOSchema = z.object({
  quiz: z.object({
    enabled: z.boolean(),
  }),
  qa: z.object({
    enabled: z.boolean(),
    title: z.string().nullable(),
    moderationMode: z.boolean(),
  }),
  quickFeedback: z.object({
    enabled: z.boolean(),
  }),
});
export type SessionChannelsDTO = z.infer<typeof SessionChannelsDTOSchema>;

export const SessionInfoDTOSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  type: SessionTypeEnum,
  status: SessionStatusEnum,
  /** ISO-8601-Serverzeit bei dieser Antwort (Client-Uhrenoffset für Countdown-Sync). */
  serverTime: z.string(),
  quizName: z.string().nullable(),
  /** Optionales Motivbild (HTTPS-URL), nur Host Quiz-Kanal. */
  quizMotifImageUrl: z.union([MotifImageUrlSchema, z.null()]).optional(),
  title: z.string().nullable().optional(),
  channels: SessionChannelsDTOSchema.optional(), // ADR-0009: Übergangsweise optional für schrittweise Migration
  participantCount: z.number(),
  nicknameTheme: NicknameThemeEnum.optional(),
  allowCustomNicknames: z.boolean().optional(),
  anonymousMode: z.boolean().optional(),
  showLeaderboard: z.boolean().optional(),
  enableSoundEffects: z.boolean().optional(),
  enableRewardEffects: z.boolean().optional(),
  enableMotivationMessages: z.boolean().optional(),
  enableEmojiReactions: z.boolean().optional(),
  readingPhaseEnabled: z.boolean().optional(),
  defaultTimer: z.number().nullable().optional(),
  backgroundMusic: z.string().nullable().optional(),
  teamMode: z.boolean().optional(),
  teamCount: z.number().nullable().optional(),
  teamAssignment: z.string().nullable().optional(),
  teamNames: z.array(z.string()).optional(),
  bonusTokenCount: z.number().nullable().optional(),
  preset: QuizPresetEnum.optional(),
});
export type SessionInfoDTO = z.infer<typeof SessionInfoDTOSchema>;

/** Output: Nach Join (Session-Info + eigene Participant-ID für vote.submit). */
export const JoinSessionOutputSchema = SessionInfoDTOSchema.extend({
  participantId: z.uuid(),
  teamId: z.uuid().nullable().optional(),
  teamName: z.string().nullable().optional(),
});
export type JoinSessionOutput = z.infer<typeof JoinSessionOutputSchema>;

/** Input: Live-Freitextdaten der aktuell aktiven Frage per Session-Code abrufen. */
export const GetLiveFreetextInputSchema = z.object({
  code: z.string().length(6, { error: 'Session-Code muss 6 Zeichen lang sein' }),
});
export type GetLiveFreetextInput = z.infer<typeof GetLiveFreetextInputSchema>;

/** DTO: Live-Freitextdaten für Word-Cloud (Story 1.14). */
export const LiveFreetextDTOSchema = z.object({
  sessionId: z.uuid(),
  questionId: z.uuid().nullable(),
  questionOrder: z.number().nullable(),
  questionType: QuestionTypeEnum.nullable(),
  questionText: z.string().nullable(),
  responses: z.array(z.string()),
  updatedAt: z.string(), // ISO-8601
});
export type LiveFreetextDTO = z.infer<typeof LiveFreetextDTOSchema>;

/** DTO: Quiz-IDs mit aktuell laufender Session (Story 1.10). */
export const ActiveQuizIdsDTOSchema = z.array(z.uuid());
export type ActiveQuizIdsDTO = z.infer<typeof ActiveQuizIdsDTOSchema>;

/** DTO: Teilnehmer-Info (Story 2.2 Lobby). */
export const ParticipantDTOSchema = z.object({
  id: z.uuid(),
  nickname: z.string(),
  teamId: z.uuid().nullable().optional(),
  teamName: z.string().nullable().optional(),
});
export type ParticipantDTO = z.infer<typeof ParticipantDTOSchema>;

/** Payload: Teilnehmerliste einer Session (Story 2.2 – getParticipants / onParticipantJoined). */
export const SessionParticipantsPayloadSchema = z.object({
  participants: z.array(ParticipantDTOSchema),
  participantCount: z.number(),
});
export type SessionParticipantsPayload = z.infer<typeof SessionParticipantsPayloadSchema>;

/** DTO: Team-Info für Join/Lobby (Story 7.1). */
export const TeamDTOSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  color: z.string().nullable(),
  memberCount: z.number().int(),
});
export type TeamDTO = z.infer<typeof TeamDTOSchema>;

/** Payload: verfügbare Teams einer Session (Story 7.1). */
export const SessionTeamsPayloadSchema = z.object({
  teams: z.array(TeamDTOSchema),
  teamCount: z.number().int(),
});
export type SessionTeamsPayload = z.infer<typeof SessionTeamsPayloadSchema>;

/** DTO: Leaderboard-Eintrag (Story 4.1) */
export const LeaderboardEntryDTOSchema = z.object({
  rank: z.number(),
  nickname: z.string(),
  totalScore: z.number(), // Gesamtpunkte (Schwierigkeit × Zeitbonus)
  correctCount: z.number(), // Anzahl richtiger Antworten
  totalQuestions: z.number(), // Gesamtanzahl Fragen
  totalResponseTimeMs: z.number(), // Gesamtantwortzeit in ms (Tiebreaker)
});
export type LeaderboardEntryDTO = z.infer<typeof LeaderboardEntryDTOSchema>;

/** DTO: Persönliche Scorecard nach jeder Frage (Story 5.6) */
export const PersonalScorecardDTOSchema = z.object({
  questionOrder: z.number(), // Frage-Nr. (1-basiert)
  totalQuestions: z.number(), // Gesamtanzahl Fragen im Quiz
  wasCorrect: z.boolean().nullable(), // null bei SURVEY/FREETEXT
  correctAnswerIds: z.array(z.uuid()).optional(), // Korrekte Antwort-IDs (bei Falsch)
  questionScore: z.number(), // Punkte für diese Frage (inkl. Streak)
  baseScore: z.number(), // Punkte vor Streak-Multiplikator
  streakCount: z.number(), // Aktuelle Serie
  streakMultiplier: z.number(), // Angewandter Streak-Faktor
  currentRank: z.number(), // Aktueller Rang
  previousRank: z.number().nullable(), // Rang nach vorheriger Frage (null bei 1. Frage)
  rankChange: z.number(), // Differenz (positiv = aufgestiegen)
  totalScore: z.number(), // Gesamtpunktzahl bisher
  bonusToken: z.string().nullable().optional(), // Story 4.6: Token-Code (nur für Top-X, sonst null)
});
export type PersonalScorecardDTO = z.infer<typeof PersonalScorecardDTOSchema>;

/** DTO: Team-Leaderboard-Eintrag (Story 7.1) */
export const TeamLeaderboardEntryDTOSchema = z.object({
  rank: z.number(),
  teamName: z.string(),
  teamColor: z.string().nullable(),
  totalScore: z.number(), // Summe aller Mitglieder-Scores
  memberCount: z.number(),
  averageScore: z.number(), // Durchschnitt pro Mitglied
});
export type TeamLeaderboardEntryDTO = z.infer<typeof TeamLeaderboardEntryDTOSchema>;

/** Input: Emoji-Reaktion senden (Story 5.8) */
export const SendEmojiReactionInputSchema = z.object({
  sessionId: z.uuid(),
  questionId: z.uuid(),
  participantId: z.uuid(),
  emoji: z.enum(EMOJI_REACTIONS),
});
export type SendEmojiReactionInput = z.infer<typeof SendEmojiReactionInputSchema>;

// ---------------------------------------------------------------------------
// Health-Check & Server-Status
// ---------------------------------------------------------------------------

/** Health-Check Response (Story 0.1: optional Redis-Status) */
export const HealthCheckResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string(),
  version: z.string(),
  redis: z.enum(['ok', 'unavailable']).optional(),
});

export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

/** DTO: Server-Auslastung für die Startseite (Story 0.4) */
export const ServerStatsDTOSchema = z.object({
  activeSessions: z.number(),
  totalParticipants: z.number(),
  completedSessions: z.number(),
  activeBlitzRounds: z.number(),
  serverStatus: z.enum(['healthy', 'busy', 'overloaded']),
});

export type ServerStatsDTO = z.infer<typeof ServerStatsDTOSchema>;

/** Ein HTTP-Roundtrip für App-Footer: Check + Stats parallel auf dem Server (kürzere kritische Netzwerk-Kette). */
export const HealthFooterBundleSchema = z.object({
  check: HealthCheckResponseSchema,
  stats: ServerStatsDTOSchema,
});
export type HealthFooterBundle = z.infer<typeof HealthFooterBundleSchema>;

/** Event der health.ping-Subscription (Story 0.2) */
export const HealthPingEventSchema = z.object({
  heartbeat: z.string(), // ISO-8601
});
export type HealthPingEvent = z.infer<typeof HealthPingEventSchema>;

// ---------------------------------------------------------------------------
// Quiz-Export / Import (Story 1.8, 1.9)
// ---------------------------------------------------------------------------

/** Aktuelle Export-Schema-Version */
export const QUIZ_EXPORT_VERSION = 1;

/** Schema für eine exportierte Antwortoption */
const ExportedAnswerOptionSchema = z.object({
  text: z.string(),
  isCorrect: z.boolean(),
});

/** Schema für eine exportierte Frage */
const ExportedQuestionSchema = z.object({
  text: z.string(),
  type: QuestionTypeEnum,
  timer: z.number().nullable().optional(),
  difficulty: DifficultyEnum,
  order: z.number(),
  answers: z.array(ExportedAnswerOptionSchema),
  ratingMin: z.number().nullable().optional(), // Nur bei RATING
  ratingMax: z.number().nullable().optional(), // Nur bei RATING
  ratingLabelMin: z.string().nullable().optional(), // Nur bei RATING
  ratingLabelMax: z.string().nullable().optional(), // Nur bei RATING
  /** false = in lokaler Bibliothek behalten, aber nicht in Live/Vorschau */
  enabled: z.boolean().optional().default(true),
});

/** Schema für das gesamte Quiz-Export-Format */
export const QuizExportSchema = z.object({
  exportVersion: z.number().int().min(1),
  exportedAt: z.string(), // ISO-8601 Timestamp
  quiz: z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    motifImageUrl: z.union([MotifImageUrlSchema, z.null()]).optional(),
    showLeaderboard: z.boolean(),
    allowCustomNicknames: z.boolean(),
    defaultTimer: z.number().int().min(5).max(300).nullable().optional(),
    enableSoundEffects: z.boolean(),
    enableRewardEffects: z.boolean(),
    enableMotivationMessages: z.boolean(),
    enableEmojiReactions: z.boolean(),
    anonymousMode: z.boolean(),
    teamMode: z.boolean(),
    teamCount: z.number().int().min(2).max(8).nullable().optional(),
    teamAssignment: TeamAssignmentEnum.optional(),
    teamNames: TeamNamesSchema.optional(),
    backgroundMusic: z.string().max(50).nullable().optional(),
    nicknameTheme: NicknameThemeEnum,
    bonusTokenCount: z.number().int().min(1).max(50).nullable().optional(), // Story 4.6
    readingPhaseEnabled: z.boolean().optional(), // Story 2.6: Lesephase
    questions: z.array(ExportedQuestionSchema).min(1),
  }),
});
export type QuizExport = z.infer<typeof QuizExportSchema>;

/**
 * Alias für Import-Validierung (Story 1.9a).
 * Import und Export nutzen bewusst dasselbe JSON-Format.
 */
export const QuizImportSchema = QuizExportSchema;
export type QuizImport = z.infer<typeof QuizImportSchema>;

// ---------------------------------------------------------------------------
// Rating-Ergebnis (Story 1.2c)
// ---------------------------------------------------------------------------

/** DTO: Aggregiertes Rating-Ergebnis für eine Skala-Frage */
export const RatingResultDTOSchema = z.object({
  questionId: z.uuid(),
  ratingMin: z.number(),
  ratingMax: z.number(),
  ratingLabelMin: z.string().nullable(),
  ratingLabelMax: z.string().nullable(),
  distribution: z.record(z.string(), z.number()), // { "1": 5, "2": 12, ... }
  average: z.number(),
  standardDeviation: z.number(),
  totalVotes: z.number(),
});
export type RatingResultDTO = z.infer<typeof RatingResultDTOSchema>;

// ---------------------------------------------------------------------------
// Bonus-Token (Story 4.6)
// ---------------------------------------------------------------------------

/** DTO: Einzelner Bonus-Token-Eintrag in der Dozenten-Liste */
export const BonusTokenEntryDTOSchema = z.object({
  token: z.string(), // z.B. "BNS-A3F7-K2M9"
  nickname: z.string(), // Pseudonym (Snapshot)
  quizName: z.string(), // Quiz-Name (Snapshot)
  totalScore: z.number(), // Erreichte Gesamtpunktzahl
  rank: z.number(), // Platzierung (1-basiert)
  generatedAt: z.string(), // ISO-8601 Timestamp
});
export type BonusTokenEntryDTO = z.infer<typeof BonusTokenEntryDTOSchema>;

/** DTO: Vollständige Bonus-Token-Liste für den Dozenten */
export const BonusTokenListDTOSchema = z.object({
  sessionId: z.uuid(),
  sessionCode: z.string(),
  quizName: z.string(),
  tokens: z.array(BonusTokenEntryDTOSchema),
});
export type BonusTokenListDTO = z.infer<typeof BonusTokenListDTOSchema>;

/** Bonus-Token-Liste inkl. Session-Zeitstempel (Quiz-Sammlung, nicht Live-Host) */
export const BonusTokenListWithSessionMetaDTOSchema = BonusTokenListDTOSchema.extend({
  endedAt: z.string().nullable(),
});
export type BonusTokenListWithSessionMetaDTO = z.infer<
  typeof BonusTokenListWithSessionMetaDTOSchema
>;

export const GetBonusTokensForQuizInputSchema = z.object({
  quizId: z.string().uuid(),
});
export type GetBonusTokensForQuizInput = z.infer<typeof GetBonusTokensForQuizInputSchema>;

export const BonusTokensForQuizOutputSchema = z.object({
  sessions: z.array(BonusTokenListWithSessionMetaDTOSchema),
});
export type BonusTokensForQuizOutput = z.infer<typeof BonusTokensForQuizOutputSchema>;

// ---------------------------------------------------------------------------
// Ergebnis-Export für Dozenten (Story 4.7) – nur aggregierte/anonyme Daten
// ---------------------------------------------------------------------------

/** Input: Export-Daten für eine beendete Session abrufen (nur Dozent, Session FINISHED) */
export const GetExportDataInputSchema = z.object({
  sessionId: z.uuid(),
});
export type GetExportDataInput = z.infer<typeof GetExportDataInputSchema>;

/** Verteilung einer Antwortoption (MC/SC) für Export */
export const OptionDistributionEntrySchema = z.object({
  text: z.string(),
  count: z.number(),
  percentage: z.number().optional(),
  isCorrect: z.boolean().optional(),
});
export type OptionDistributionEntry = z.infer<typeof OptionDistributionEntrySchema>;

/** Aggregierte Freitext-Antwort (Begriff + Häufigkeit) für Export */
export const FreetextAggregateEntrySchema = z.object({
  text: z.string(),
  count: z.number(),
});
export type FreetextAggregateEntry = z.infer<typeof FreetextAggregateEntrySchema>;

/** Aggregierte Session-Freitextdaten für Export (Story 1.14). */
export const FreetextSessionExportEntrySchema = z.object({
  questionId: z.uuid(),
  questionOrder: z.number(),
  questionText: z.string(),
  aggregates: z.array(FreetextAggregateEntrySchema),
});
export type FreetextSessionExportEntry = z.infer<typeof FreetextSessionExportEntrySchema>;

export const FreetextSessionExportDTOSchema = z.object({
  sessionId: z.uuid(),
  sessionCode: z.string(),
  exportedAt: z.string(),
  entries: z.array(FreetextSessionExportEntrySchema),
});
export type FreetextSessionExportDTO = z.infer<typeof FreetextSessionExportDTOSchema>;

/** Ein Eintrag pro Frage im Session-Export (aggregiert, keine Nicknames) */
export const QuestionExportEntrySchema = z.object({
  questionOrder: z.number(),
  questionTextShort: z.string(), // z. B. erste 100 Zeichen des Fragenstamms
  type: QuestionTypeEnum,
  participantCount: z.number(), // Anzahl abgegebener Votes für diese Frage
  optionDistribution: z.array(OptionDistributionEntrySchema).optional(), // MC/SC
  freetextAggregates: z.array(FreetextAggregateEntrySchema).optional(), // FREETEXT
  ratingDistribution: z.record(z.string(), z.number()).optional(), // RATING: "1" -> 5, "2" -> 12
  ratingAverage: z.number().optional(),
  ratingStandardDeviation: z.number().optional(),
  averageScore: z.number().optional(), // Durchschnittspunkte (wenn gescored)
});
export type QuestionExportEntry = z.infer<typeof QuestionExportEntrySchema>;

/** DTO: Vollständiger Session-Export für Dozenten (CSV/PDF-Generierung) – DSGVO-konform, nur aggregiert */
export const SessionExportDTOSchema = z.object({
  sessionId: z.uuid(),
  sessionCode: z.string(),
  quizName: z.string(),
  finishedAt: z.string(), // ISO-8601
  participantCount: z.number(),
  questions: z.array(QuestionExportEntrySchema),
  bonusTokens: z.array(BonusTokenEntryDTOSchema).optional(), // optional einbeziehen (Pseudonyme)
});
export type SessionExportDTO = z.infer<typeof SessionExportDTOSchema>;

// ---------------------------------------------------------------------------
// Admin (Epic 9)
// ---------------------------------------------------------------------------

/** Input: Admin-Login per Shared Secret (MVP). */
export const AdminLoginInputSchema = z.object({
  secret: z.string().trim().min(1).max(512),
});
export type AdminLoginInput = z.infer<typeof AdminLoginInputSchema>;

/** Output: Admin-Login erfolgreich, Token mit Ablaufzeit. */
export const AdminLoginOutputSchema = z.object({
  token: z.string().min(32),
  expiresAt: z.string(), // ISO-8601
});
export type AdminLoginOutput = z.infer<typeof AdminLoginOutputSchema>;

/** Input: Session-Lookup im Admin-Bereich über 6-stelligen Code. */
export const AdminSessionLookupInputSchema = z.object({
  code: z.string().trim().length(6),
});
export type AdminSessionLookupInput = z.infer<typeof AdminSessionLookupInputSchema>;

/** Input: Admin-Sessionliste mit optionalen Filtern und Pagination. */
export const AdminListSessionsInputSchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(25),
  status: SessionStatusEnum.optional(),
  type: SessionTypeEnum.optional(),
  code: z.string().trim().length(6).optional(),
});
export type AdminListSessionsInput = z.infer<typeof AdminListSessionsInputSchema>;

/** Input: Admin-Sessiondetail via Session-ID. */
export const AdminGetSessionDetailInputSchema = z.object({
  sessionId: z.uuid(),
});
export type AdminGetSessionDetailInput = z.infer<typeof AdminGetSessionDetailInputSchema>;

/** Recherchefenster laut Epic 9 (A/B/C). */
export const AdminRetentionWindowEnum = z.enum(['RUNNING', 'POST_SESSION_24H', 'PURGED']);
export type AdminRetentionWindow = z.infer<typeof AdminRetentionWindowEnum>;

/** Retention-Status inkl. optionalem Legal Hold. */
export const AdminRetentionStateDTOSchema = z.object({
  window: AdminRetentionWindowEnum,
  legalHoldUntil: z.string().nullable().optional(),
  legalHoldReason: z.string().nullable().optional(),
});
export type AdminRetentionStateDTO = z.infer<typeof AdminRetentionStateDTOSchema>;

/** Kompakter Admin-Listeneintrag für Sessions. */
export const AdminSessionSummaryDTOSchema = z.object({
  sessionId: z.uuid(),
  sessionCode: z.string().length(6),
  type: SessionTypeEnum,
  status: SessionStatusEnum,
  quizName: z.string().nullable(),
  participantCount: z.number().int().min(0),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  retention: AdminRetentionStateDTOSchema,
});
export type AdminSessionSummaryDTO = z.infer<typeof AdminSessionSummaryDTOSchema>;

/** Session-Liste für Admin mit Pagination-Metadaten. */
export const AdminSessionListDTOSchema = z.object({
  sessions: z.array(AdminSessionSummaryDTOSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
export type AdminSessionListDTO = z.infer<typeof AdminSessionListDTOSchema>;

/** Vollständige Admin-Detailansicht einer Session (read-only). */
export const AdminSessionDetailDTOSchema = z.object({
  session: AdminSessionSummaryDTOSchema,
  title: z.string().nullable().optional(),
  questions: z
    .array(
      z.object({
        id: z.uuid(),
        order: z.number().int().min(0),
        text: z.string(),
        type: QuestionTypeEnum,
        answers: z.array(
          z.object({
            id: z.uuid(),
            text: z.string(),
            isCorrect: z.boolean(),
          }),
        ),
      }),
    )
    .optional(),
});
export type AdminSessionDetailDTO = z.infer<typeof AdminSessionDetailDTOSchema>;

/** Input: Legal Hold setzen/lösen. */
export const AdminSetLegalHoldInputSchema = z.object({
  sessionId: z.uuid(),
  enabled: z.boolean(),
  reason: z.string().trim().max(1000).optional(),
  holdDays: z.number().int().min(1).max(365).optional(),
});
export type AdminSetLegalHoldInput = z.infer<typeof AdminSetLegalHoldInputSchema>;

/** Input: Session endgültig löschen (Story 9.2). */
export const AdminDeleteSessionInputSchema = z.object({
  sessionId: z.uuid(),
  reason: z.string().trim().max(1000).optional(),
});
export type AdminDeleteSessionInput = z.infer<typeof AdminDeleteSessionInputSchema>;

/** Output: Session-Löschung bestätigt. */
export const AdminDeleteSessionOutputSchema = z.object({
  deleted: z.literal(true),
  sessionId: z.uuid(),
  sessionCode: z.string().length(6),
});
export type AdminDeleteSessionOutput = z.infer<typeof AdminDeleteSessionOutputSchema>;

/** Export-Format für Behördenauszug (Story 9.3). */
export const AdminExportFormatEnum = z.enum(['PDF', 'JSON']);
export type AdminExportFormat = z.infer<typeof AdminExportFormatEnum>;

/** Input: Behördenexport anstoßen. */
export const AdminExportInputSchema = z.object({
  sessionId: z.uuid(),
  format: AdminExportFormatEnum.default('PDF'),
  reason: z.string().trim().max(1000).optional(),
  caseReference: z.string().trim().max(200).optional(),
});
export type AdminExportInput = z.infer<typeof AdminExportInputSchema>;

/** Output: Exportdatei als Base64 für Download im Frontend. */
export const AdminExportOutputSchema = z.object({
  exportId: z.uuid(),
  format: AdminExportFormatEnum,
  mimeType: z.string(),
  fileName: z.string(),
  contentBase64: z.string(),
  sha256: z.string().length(64),
  generatedAt: z.string(),
});
export type AdminExportOutput = z.infer<typeof AdminExportOutputSchema>;

/** Audit-Log-Eintrag für Admin-Aktionen. */
export const AdminAuditLogEntryDTOSchema = z.object({
  id: z.uuid(),
  action: z.enum(['SESSION_DELETE', 'EXPORT_FOR_AUTHORITIES']),
  sessionId: z.string(),
  sessionCode: z.string(),
  adminIdentifier: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type AdminAuditLogEntryDTO = z.infer<typeof AdminAuditLogEntryDTOSchema>;

/** Output: Admin-Session gültig. */
export const AdminWhoAmIOutputSchema = z.object({
  authenticated: z.literal(true),
});
export type AdminWhoAmIOutput = z.infer<typeof AdminWhoAmIOutputSchema>;

// ---------------------------------------------------------------------------
// Q&A-Modus (Epic 8)
// ---------------------------------------------------------------------------

/** DTO: Eine Q&A-Frage */
export const QaQuestionDTOSchema = z.object({
  id: z.uuid(),
  text: z.string(),
  upvoteCount: z.number(),
  status: QaQuestionStatusEnum,
  createdAt: z.string(),
  /** 'UP' | 'DOWN' | null — aktueller Vote-Status dieses Teilnehmers */
  myVote: z.enum(['UP', 'DOWN']).nullable(),
  /** true wenn die Frage vom aktuellen Teilnehmer stammt */
  isOwn: z.boolean(),
  /** @deprecated – wird durch myVote ersetzt */
  hasUpvoted: z.boolean(),
});
export type QaQuestionDTO = z.infer<typeof QaQuestionDTOSchema>;

export const QaQuestionsListDTOSchema = z.array(QaQuestionDTOSchema);
export type QaQuestionsListDTO = z.infer<typeof QaQuestionsListDTOSchema>;

export const GetQaQuestionsInputSchema = z.object({
  sessionId: z.uuid(),
  participantId: z.uuid().optional(),
  moderatorView: z.boolean().optional().default(false),
});
export type GetQaQuestionsInput = z.infer<typeof GetQaQuestionsInputSchema>;

/** Input: Q&A-Frage einreichen (Story 8.2) */
export const SubmitQaQuestionInputSchema = z.object({
  sessionId: z.uuid(),
  participantId: z.uuid(),
  text: z.string().min(1).max(500),
});
export type SubmitQaQuestionInput = z.infer<typeof SubmitQaQuestionInputSchema>;

/** Input: Q&A-Frage upvoten (Story 8.3) – Legacy */
export const UpvoteQaQuestionInputSchema = z.object({
  questionId: z.uuid(),
  participantId: z.uuid(),
});
export type UpvoteQaQuestionInput = z.infer<typeof UpvoteQaQuestionInputSchema>;

export const ToggleQaUpvoteOutputSchema = z.object({
  questionId: z.uuid(),
  upvoted: z.boolean(),
  upvoteCount: z.number(),
});
export type ToggleQaUpvoteOutput = z.infer<typeof ToggleQaUpvoteOutputSchema>;

/** Input: Q&A-Frage voten (UP / DOWN / toggle-off) */
export const QaVoteInputSchema = z.object({
  questionId: z.uuid(),
  participantId: z.uuid(),
  direction: z.enum(['UP', 'DOWN']),
});
export type QaVoteInput = z.infer<typeof QaVoteInputSchema>;

export const QaVoteOutputSchema = z.object({
  questionId: z.uuid(),
  myVote: z.enum(['UP', 'DOWN']).nullable(),
  upvoteCount: z.number(),
});
export type QaVoteOutput = z.infer<typeof QaVoteOutputSchema>;

/** Input: Q&A-Moderation an/aus toggeln (Host) */
export const ToggleQaModerationInputSchema = z.object({
  sessionCode: z.string().trim().min(6).max(6),
  enabled: z.boolean(),
});
export type ToggleQaModerationInput = z.infer<typeof ToggleQaModerationInputSchema>;

export const ModerateQaQuestionActionEnum = z.enum([
  'APPROVE',
  'PIN',
  'UNPIN',
  'ARCHIVE',
  'DELETE',
]);
export type ModerateQaQuestionAction = z.infer<typeof ModerateQaQuestionActionEnum>;

export const ModerateQaQuestionInputSchema = z.object({
  sessionCode: z.string().trim().min(6).max(6),
  questionId: z.uuid(),
  action: ModerateQaQuestionActionEnum,
});
export type ModerateQaQuestionInput = z.infer<typeof ModerateQaQuestionInputSchema>;

// ---------------------------------------------------------------------------
// SC-Schnellformate (Story 1.12) — clientseitig angewandt
// ---------------------------------------------------------------------------

/** Verfügbare Single-Choice-Schnellformate */
export const ScFormatEnum = z.enum([
  'YES_NO',
  'YES_NO_MAYBE',
  'YES_NO_DONT_KNOW',
  'TRUE_FALSE',
  'ABCD',
]);
export type ScFormat = z.infer<typeof ScFormatEnum>;

/** Vorkonfigurierte Antwortoptionen pro SC-Format (Texte werden bei i18n lokalisiert) */
export const SC_FORMAT_PRESETS: Record<ScFormat, { label: string; answers: string[] }> = {
  YES_NO: { label: 'Ja / Nein', answers: ['Ja', 'Nein'] },
  YES_NO_MAYBE: { label: 'Ja / Nein / Vielleicht', answers: ['Ja', 'Nein', 'Vielleicht'] },
  YES_NO_DONT_KNOW: { label: 'Ja / Nein / Weiß nicht', answers: ['Ja', 'Nein', 'Weiß nicht'] },
  TRUE_FALSE: { label: 'Wahr / Falsch', answers: ['Wahr', 'Falsch'] },
  ABCD: { label: 'A / B / C / D', answers: ['A', 'B', 'C', 'D'] },
};

/** Preset-Konfigurationen (Story 1.11) — clientseitig angewandt */
export const QUIZ_PRESETS: Record<QuizPreset, Partial<CreateQuizInput>> = {
  PLAYFUL: {
    showLeaderboard: true,
    enableSoundEffects: true,
    enableRewardEffects: true,
    enableMotivationMessages: true,
    enableEmojiReactions: true,
    anonymousMode: false,
    readingPhaseEnabled: false, // Story 2.6: Schnelles Spieltempo
  },
  SERIOUS: {
    showLeaderboard: false,
    enableSoundEffects: false,
    enableRewardEffects: false,
    enableMotivationMessages: false,
    enableEmojiReactions: false,
    anonymousMode: true,
    defaultTimer: null, // Offene Antwortphase (kein Countdown)
    readingPhaseEnabled: true, // Story 2.6: Frage zuerst lesen
  },
};

// ---------------------------------------------------------------------------
// Preset-Export / Import (Story 1.15)
// ---------------------------------------------------------------------------

/** Aktuelle Export-Schema-Version für Preset-Dateien */
export const PRESET_EXPORT_VERSION = 1;

export const NameModeEnum = z.enum(['nicknameTheme', 'allowCustomNicknames', 'anonymousMode']);
export type NameMode = z.infer<typeof NameModeEnum>;

export const PresetStorageEntrySchema = z.object({
  options: z.record(z.string(), z.boolean()),
  nameMode: NameModeEnum,
  nicknameThemeValue: NicknameThemeEnum,
  teamCountValue: z.number().int().min(2).max(8),
});
export type PresetStorageEntry = z.infer<typeof PresetStorageEntrySchema>;

export const PresetConfigExportSchema = z.object({
  presetExportVersion: z.number().int().min(1),
  exportedAt: z.string(), // ISO-8601
  activePreset: z.enum(['serious', 'spielerisch']),
  theme: z.enum(['system', 'dark', 'light']),
  presets: z.object({
    serious: PresetStorageEntrySchema,
    spielerisch: PresetStorageEntrySchema,
  }),
});
export type PresetConfigExport = z.infer<typeof PresetConfigExportSchema>;

// ---------------------------------------------------------------------------
// Quick-Feedback (One-Shot-Feedback)
// ---------------------------------------------------------------------------

export const QuickFeedbackTypeEnum = z.enum([
  'MOOD',
  'YESNO',
  'YESNO_BINARY',
  'TRUEFALSE_UNKNOWN',
  'ABC',
  'ABCD',
]);
export type QuickFeedbackType = z.infer<typeof QuickFeedbackTypeEnum>;

export const MoodValueEnum = z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']);
export type MoodValue = z.infer<typeof MoodValueEnum>;

export const AbcdValueEnum = z.enum(['A', 'B', 'C', 'D']);
export type AbcdValue = z.infer<typeof AbcdValueEnum>;

export const YesNoValueEnum = z.enum(['YES', 'NO', 'MAYBE']);
export type YesNoValue = z.infer<typeof YesNoValueEnum>;

export const YesNoBinaryValueEnum = z.enum(['YES', 'NO']);
export type YesNoBinaryValue = z.infer<typeof YesNoBinaryValueEnum>;

export const TrueFalseUnknownValueEnum = z.enum(['TRUE', 'FALSE', 'UNKNOWN']);
export type TrueFalseUnknownValue = z.infer<typeof TrueFalseUnknownValueEnum>;

export const AbcValueEnum = z.enum(['A', 'B', 'C']);
export type AbcValue = z.infer<typeof AbcValueEnum>;

export const QuickFeedbackThemeEnum = z.enum(['system', 'dark', 'light']);
export const QuickFeedbackPresetEnum = z.enum(['serious', 'spielerisch']);

export const CreateQuickFeedbackInputSchema = z.object({
  type: QuickFeedbackTypeEnum,
  theme: QuickFeedbackThemeEnum,
  preset: QuickFeedbackPresetEnum,
  sessionCode: z.string().trim().length(6).optional(),
});
export type CreateQuickFeedbackInput = z.infer<typeof CreateQuickFeedbackInputSchema>;

export const UpdateQuickFeedbackStyleInputSchema = z.object({
  sessionCode: z.string(),
  theme: QuickFeedbackThemeEnum,
  preset: QuickFeedbackPresetEnum,
});
export type UpdateQuickFeedbackStyleInput = z.infer<typeof UpdateQuickFeedbackStyleInputSchema>;

export const UpdateQuickFeedbackTypeInputSchema = z.object({
  sessionCode: z.string().trim().length(6),
  type: QuickFeedbackTypeEnum,
  theme: QuickFeedbackThemeEnum,
  preset: QuickFeedbackPresetEnum,
});
export type UpdateQuickFeedbackTypeInput = z.infer<typeof UpdateQuickFeedbackTypeInputSchema>;

export const CreateQuickFeedbackOutputSchema = z.object({
  feedbackId: z.string(),
  sessionCode: z.string(),
});
export type CreateQuickFeedbackOutput = z.infer<typeof CreateQuickFeedbackOutputSchema>;

export const QuickFeedbackVoteInputSchema = z.object({
  sessionCode: z.string(),
  voterId: z.string().uuid(),
  value: z.string(),
});
export type QuickFeedbackVoteInput = z.infer<typeof QuickFeedbackVoteInputSchema>;

/** Nur Redis-EXISTS – kein 404, damit Probes (z. B. Home „Letzte Sessions“) keine Konsolen-Fehler erzeugen. */
export const QuickFeedbackIsActiveOutputSchema = z.object({ active: z.boolean() });
export type QuickFeedbackIsActiveOutput = z.infer<typeof QuickFeedbackIsActiveOutputSchema>;

export const QuickFeedbackResultSchema = z.object({
  type: QuickFeedbackTypeEnum,
  theme: QuickFeedbackThemeEnum,
  preset: QuickFeedbackPresetEnum,
  locked: z.boolean(),
  totalVotes: z.number(),
  distribution: z.record(z.string(), z.number()),
  currentRound: z.number().int().min(1).max(2).optional(),
  discussion: z.boolean().optional(),
  round1Distribution: z.record(z.string(), z.number()).optional(),
  round1Total: z.number().int().optional(),
  opinionShift: OpinionShiftSchema.optional(),
});
export type QuickFeedbackResult = z.infer<typeof QuickFeedbackResultSchema>;

// ─── Session-Bewertung (Story 4.8) ───────────────────────────────────────────

export const SubmitSessionFeedbackInputSchema = z.object({
  code: z.string().length(6),
  participantId: z.string().uuid(),
  overallRating: z.number().int().min(1).max(5),
  questionQualityRating: z.number().int().min(1).max(5).optional(),
  wouldRepeat: z.boolean().optional(),
});
export type SubmitSessionFeedbackInput = z.infer<typeof SubmitSessionFeedbackInputSchema>;

export const SessionFeedbackSummarySchema = z.object({
  totalResponses: z.number(),
  overallAverage: z.number(),
  overallDistribution: z.record(z.string(), z.number()),
  questionQualityAverage: z.number().nullable(),
  questionQualityDistribution: z.record(z.string(), z.number()).nullable(),
  wouldRepeatYes: z.number(),
  wouldRepeatNo: z.number(),
});
export type SessionFeedbackSummary = z.infer<typeof SessionFeedbackSummarySchema>;

/** Letztes Session-Feedback zu einer Server-Quiz-ID (Quiz-Sammlung; gleicher Scope wie getBonusTokensForQuiz). */
export const GetLastSessionFeedbackForQuizInputSchema = GetBonusTokensForQuizInputSchema;
export type GetLastSessionFeedbackForQuizInput = z.infer<
  typeof GetLastSessionFeedbackForQuizInputSchema
>;

export const LastSessionFeedbackForQuizDTOSchema = z.object({
  sessionId: z.string().uuid(),
  sessionCode: z.string(),
  endedAt: z.string().nullable(),
  summary: SessionFeedbackSummarySchema,
});
export type LastSessionFeedbackForQuizDTO = z.infer<typeof LastSessionFeedbackForQuizDTOSchema>;

export const LastSessionFeedbackForQuizOutputSchema =
  LastSessionFeedbackForQuizDTOSchema.nullable();
export type LastSessionFeedbackForQuizOutput = z.infer<
  typeof LastSessionFeedbackForQuizOutputSchema
>;

// ─── MOTD / Plattform-Kommunikation (Epic 10) ───────────────────────────────

/** UI-Locales (ADR-0008) — synchron mit Angular-Builds */
export const AppLocaleEnum = z.enum(['de', 'en', 'fr', 'es', 'it']);
export type AppLocale = z.infer<typeof AppLocaleEnum>;

/** Fallback-Kette wenn Übersetzung fehlt: angefragte Locale → de → en → rest */
export const MOTD_LOCALE_FALLBACK_ORDER: AppLocale[] = ['de', 'en', 'fr', 'es', 'it'];

export const MotdStatusEnum = z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']);
export type MotdStatus = z.infer<typeof MotdStatusEnum>;

export const MotdAuditActionEnum = z.enum([
  'MOTD_CREATE',
  'MOTD_UPDATE',
  'MOTD_DELETE',
  'MOTD_PUBLISH',
  'MOTD_ARCHIVE_VISIBILITY',
  'MOTD_TEMPLATE_CREATE',
  'MOTD_TEMPLATE_UPDATE',
  'MOTD_TEMPLATE_DELETE',
]);
export type MotdAuditAction = z.infer<typeof MotdAuditActionEnum>;

export const MotdInteractionKindEnum = z.enum([
  'ACK',
  'THUMB_UP',
  'THUMB_DOWN',
  'DISMISS_CLOSE',
  'DISMISS_SWIPE',
]);
export type MotdInteractionKind = z.infer<typeof MotdInteractionKindEnum>;

/** Max. Markdown-Länge pro Sprache (Schutz vor Abuse) */
export const MOTD_MARKDOWN_MAX_LENGTH = 16000;

const motdMarkdownField = z.string().max(MOTD_MARKDOWN_MAX_LENGTH);

export const MotdLocaleBodiesSchema = z.object({
  de: motdMarkdownField.optional().default(''),
  en: motdMarkdownField.optional().default(''),
  fr: motdMarkdownField.optional().default(''),
  es: motdMarkdownField.optional().default(''),
  it: motdMarkdownField.optional().default(''),
});
export type MotdLocaleBodies = z.infer<typeof MotdLocaleBodiesSchema>;

/** Öffentlich: aktive oder Archiv-MOTD (nur aufgelöster Markdown, kein HTML vom Server) */
export const MotdPublicDTOSchema = z.object({
  id: z.uuid(),
  contentVersion: z.number().int().min(1),
  markdown: z.string(),
  endsAt: z.string(),
});
export type MotdPublicDTO = z.infer<typeof MotdPublicDTOSchema>;

/** Lokal als gelesen/dismissed markierte Overlay-MOTD (pro ID max. bestätigte `contentVersion`). */
export const MotdOverlayDismissedPairSchema = z.object({
  motdId: z.string().uuid(),
  contentVersion: z.number().int().min(1),
});
export type MotdOverlayDismissedPair = z.infer<typeof MotdOverlayDismissedPairSchema>;

export const MotdGetCurrentInputSchema = z.object({
  locale: AppLocaleEnum,
  overlayDismissedUpTo: z.array(MotdOverlayDismissedPairSchema).max(32).optional(),
});
export type MotdGetCurrentInput = z.infer<typeof MotdGetCurrentInputSchema>;

export const MotdGetCurrentOutputSchema = z.object({
  motd: MotdPublicDTOSchema.nullable(),
});
export type MotdGetCurrentOutput = z.infer<typeof MotdGetCurrentOutputSchema>;

export const MotdListArchiveInputSchema = z.object({
  locale: AppLocaleEnum,
  cursor: z.string().uuid().optional(),
  pageSize: z.number().int().min(1).max(50).default(20),
});
export type MotdListArchiveInput = z.infer<typeof MotdListArchiveInputSchema>;

export const MotdArchiveItemDTOSchema = z.object({
  id: z.uuid(),
  contentVersion: z.number().int().min(1),
  markdown: z.string(),
  /** Veröffentlichungs-/Startzeitpunkt (Anzeige im Archiv). */
  startsAt: z.string(),
  endsAt: z.string(),
});
export type MotdArchiveItemDTO = z.infer<typeof MotdArchiveItemDTOSchema>;

export const MotdListArchiveOutputSchema = z.object({
  items: z.array(MotdArchiveItemDTOSchema),
  nextCursor: z.uuid().nullable(),
});
export type MotdListArchiveOutput = z.infer<typeof MotdListArchiveOutputSchema>;

/** Header: ob Nachrichten-Icon sinnvoll ist */
export const MotdHeaderStateInputSchema = z.object({
  locale: AppLocaleEnum,
  /** Client-Wasserzeichen: MOTDs mit späterem `endsAt` gelten als ungelesen (globales Archiv). */
  archiveSeenUpToEndsAtIso: z.string().optional(),
  overlayDismissedUpTo: z.array(MotdOverlayDismissedPairSchema).max(32).optional(),
});
export type MotdHeaderStateInput = z.infer<typeof MotdHeaderStateInputSchema>;

export const MotdHeaderStateOutputSchema = z.object({
  hasActiveOverlay: z.boolean(),
  hasArchiveEntries: z.boolean(),
  /** Anzahl MOTDs, die ins Nutzer-Archiv zählen (gleiche Filterlogik wie listArchive, ohne leere Markdown-Fallbacks). */
  archiveCount: z.number().int().min(0),
  /** Spätestes Archiv-Ende (ISO); null wenn kein Eintrag. Für „Alles als gelesen“ auf dem Client. */
  archiveMaxEndsAtIso: z.string().nullable(),
  /** Ungelesen relativ zu `archiveSeenUpToEndsAtIso`; ohne gültiges Wasserzeichen = `archiveCount`. */
  archiveUnreadCount: z.number().int().min(0),
});
export type MotdHeaderStateOutput = z.infer<typeof MotdHeaderStateOutputSchema>;

export const MotdRecordInteractionInputSchema = z.object({
  motdId: z.uuid(),
  contentVersion: z.number().int().min(1),
  kind: MotdInteractionKindEnum,
});
export type MotdRecordInteractionInput = z.infer<typeof MotdRecordInteractionInputSchema>;

export const MotdRecordInteractionOutputSchema = z.object({ ok: z.literal(true) });
export type MotdRecordInteractionOutput = z.infer<typeof MotdRecordInteractionOutputSchema>;

// --- Admin: Templates ---

export const AdminMotdTemplateListItemDTOSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  updatedAt: z.string(),
});
export type AdminMotdTemplateListItemDTO = z.infer<typeof AdminMotdTemplateListItemDTOSchema>;

export const AdminMotdTemplateDTOSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  markdownDe: z.string(),
  markdownEn: z.string(),
  markdownFr: z.string(),
  markdownEs: z.string(),
  markdownIt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminMotdTemplateDTO = z.infer<typeof AdminMotdTemplateDTOSchema>;

export const AdminMotdTemplateCreateInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  markdownDe: motdMarkdownField.optional().default(''),
  markdownEn: motdMarkdownField.optional().default(''),
  markdownFr: motdMarkdownField.optional().default(''),
  markdownEs: motdMarkdownField.optional().default(''),
  markdownIt: motdMarkdownField.optional().default(''),
});
export type AdminMotdTemplateCreateInput = z.infer<typeof AdminMotdTemplateCreateInputSchema>;

export const AdminMotdTemplateUpdateInputSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  markdownDe: motdMarkdownField.optional(),
  markdownEn: motdMarkdownField.optional(),
  markdownFr: motdMarkdownField.optional(),
  markdownEs: motdMarkdownField.optional(),
  markdownIt: motdMarkdownField.optional(),
});
export type AdminMotdTemplateUpdateInput = z.infer<typeof AdminMotdTemplateUpdateInputSchema>;

// --- Admin: MOTDs ---

/** Aggregierte Nutzerreaktionen auf eine MOTD (Epic 10, öffentliches recordInteraction). */
export const AdminMotdInteractionStatsSchema = z.object({
  ackCount: z.number().int().nonnegative(),
  thumbUp: z.number().int().nonnegative(),
  thumbDown: z.number().int().nonnegative(),
  dismissClose: z.number().int().nonnegative(),
  dismissSwipe: z.number().int().nonnegative(),
});
export type AdminMotdInteractionStats = z.infer<typeof AdminMotdInteractionStatsSchema>;

export const AdminMotdListItemDTOSchema = z.object({
  id: z.uuid(),
  status: MotdStatusEnum,
  priority: z.number().int(),
  startsAt: z.string(),
  endsAt: z.string(),
  visibleInArchive: z.boolean(),
  contentVersion: z.number().int(),
  templateId: z.uuid().nullable(),
  updatedAt: z.string(),
  interaction: AdminMotdInteractionStatsSchema,
});
export type AdminMotdListItemDTO = z.infer<typeof AdminMotdListItemDTOSchema>;

export const AdminMotdDetailDTOSchema = z.object({
  id: z.uuid(),
  status: MotdStatusEnum,
  priority: z.number().int(),
  startsAt: z.string(),
  endsAt: z.string(),
  visibleInArchive: z.boolean(),
  contentVersion: z.number().int(),
  templateId: z.uuid().nullable(),
  locales: MotdLocaleBodiesSchema,
  interaction: AdminMotdInteractionStatsSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminMotdDetailDTO = z.infer<typeof AdminMotdDetailDTOSchema>;

export const AdminMotdCreateInputSchema = z.object({
  status: MotdStatusEnum.default('DRAFT'),
  priority: z.number().int().min(0).max(1_000_000).default(0),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  visibleInArchive: z.boolean().default(false),
  templateId: z.uuid().optional().nullable(),
  locales: MotdLocaleBodiesSchema,
});
export type AdminMotdCreateInput = z.infer<typeof AdminMotdCreateInputSchema>;

export const AdminMotdUpdateInputSchema = z.object({
  id: z.uuid(),
  status: MotdStatusEnum.optional(),
  priority: z.number().int().min(0).max(1_000_000).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  visibleInArchive: z.boolean().optional(),
  templateId: z.uuid().optional().nullable(),
  locales: MotdLocaleBodiesSchema.optional(),
});
export type AdminMotdUpdateInput = z.infer<typeof AdminMotdUpdateInputSchema>;

export const AdminMotdIdInputSchema = z.object({ id: z.uuid() });
export type AdminMotdIdInput = z.infer<typeof AdminMotdIdInputSchema>;

export const AdminMotdTemplateListOutputSchema = z.array(AdminMotdTemplateListItemDTOSchema);
export const AdminMotdListOutputSchema = z.array(AdminMotdListItemDTOSchema);
