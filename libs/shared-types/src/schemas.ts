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

export const QaQuestionStatusEnum = z.enum([
  'PENDING',
  'ACTIVE',
  'PINNED',
  'ARCHIVED',
  'DELETED',
]);
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
// Quiz-Schemas (Zod) – werden in Backend (Validierung) & Frontend (Forms) genutzt
// ---------------------------------------------------------------------------

/** Schema für die Erstellung eines neuen Quizzes */
export const CreateQuizInputSchema = z.object({
  name: z.string().min(1, { error: 'Quiz-Name darf nicht leer sein' }).max(200),
  description: z.string().max(1000).optional(),
  showLeaderboard: z.boolean().optional().default(true),
  allowCustomNicknames: z.boolean().optional().default(true),
  defaultTimer: z.number().int().min(5).max(300).nullable().optional(),
  enableSoundEffects: z.boolean().optional().default(true),
  enableRewardEffects: z.boolean().optional().default(true),
  enableMotivationMessages: z.boolean().optional().default(true),
  enableEmojiReactions: z.boolean().optional().default(true),
  anonymousMode: z.boolean().optional().default(false),
  teamMode: z.boolean().optional().default(false),
  teamCount: z.number().int().min(2).max(8).optional(),
  teamAssignment: TeamAssignmentEnum.optional().default('AUTO'),
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
  ratingMin: z.number().int().min(0).max(10).optional(),    // Nur bei RATING
  ratingMax: z.number().int().min(1).max(10).optional(),    // Nur bei RATING
  ratingLabelMin: z.string().max(50).optional(),            // Nur bei RATING
  ratingLabelMax: z.string().max(50).optional(),            // Nur bei RATING
});
export type AddQuestionInput = z.infer<typeof AddQuestionInputSchema>;

/** Schema für den Quiz-Upload beim Live-Schalten (Story 2.1a) */
export const QuizUploadInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
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
  backgroundMusic: z.string().max(50).nullable().optional(),
  nicknameTheme: NicknameThemeEnum,
  bonusTokenCount: z.number().int().min(1).max(50).nullable().optional(), // Story 4.6
  readingPhaseEnabled: z.boolean().optional(),
  preset: QuizPresetEnum.optional(),
  questions: z.array(AddQuestionInputSchema).min(1, { error: 'Mindestens eine Frage erforderlich' }),
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
export const CreateSessionInputSchema = z.object({
  type: SessionTypeEnum.optional().default('QUIZ'),       // Story 8.1: Quiz oder Q&A
  quizId: z.uuid().optional(),                    // Pflicht bei QUIZ, null bei Q_AND_A
  title: z.string().max(200).optional(),                   // Story 8.1: Titel für Q&A-Runde
  moderationMode: z.boolean().optional().default(false),   // Story 8.4: Q&A-Fragen moderieren
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
  order: z.number().int().min(0),
  text: z.string(),
  type: QuestionTypeEnum,
  timer: z.number().nullable().optional(),
  answers: z.array(z.object({
    id: z.uuid(),
    text: z.string(),
    isCorrect: z.boolean(),
  })),
  ratingMin: z.number().nullable().optional(),
  ratingMax: z.number().nullable().optional(),
  ratingLabelMin: z.string().nullable().optional(),
  ratingLabelMax: z.string().nullable().optional(),
  ratingAvg: z.number().nullable().optional(),
  ratingCount: z.number().int().optional(),
  ratingDistribution: z.record(z.string(), z.number()).optional(),
  freeTextResponses: z.array(z.string()).optional(),
  voteDistribution: z.array(z.object({
    id: z.uuid(),
    text: z.string(),
    isCorrect: z.boolean(),
    voteCount: z.number().int(),
    votePercentage: z.number().int(),
  })).optional(),
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
  voteCount: z.number(),        // Anzahl Votes für diese Option
  votePercentage: z.number(),   // Prozentualer Anteil (0–100)
});
export type AnswerOptionRevealedDTO = z.infer<typeof AnswerOptionRevealedDTOSchema>;

/** DTO: Frage mit aufgelösten Ergebnissen (Story 3.4, 4.4) */
export const QuestionRevealedDTOSchema = z.object({
  id: z.uuid(),
  text: z.string(),
  type: QuestionTypeEnum,
  difficulty: DifficultyEnum,
  order: z.number(),
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
  ratingMin: z.number().nullable().optional(),        // Nur bei RATING
  ratingMax: z.number().nullable().optional(),        // Nur bei RATING
  ratingLabelMin: z.string().nullable().optional(),   // Nur bei RATING
  ratingLabelMax: z.string().nullable().optional(),   // Nur bei RATING
});
export type QuestionPreviewDTO = z.infer<typeof QuestionPreviewDTOSchema>;

/** DTO: Session-Info für den Beitritt (Story 3.1, 3.2). Enthält Nickname-Konfiguration bei QUIZ. */
export const SessionInfoDTOSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  type: SessionTypeEnum,
  status: SessionStatusEnum,
  quizName: z.string().nullable(),
  title: z.string().nullable().optional(),
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
  bonusTokenCount: z.number().nullable().optional(),
  preset: QuizPresetEnum.optional(),
});
export type SessionInfoDTO = z.infer<typeof SessionInfoDTOSchema>;

/** Output: Nach Join (Session-Info + eigene Participant-ID für vote.submit). */
export const JoinSessionOutputSchema = SessionInfoDTOSchema.extend({
  participantId: z.uuid(),
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
});
export type ParticipantDTO = z.infer<typeof ParticipantDTOSchema>;

/** Payload: Teilnehmerliste einer Session (Story 2.2 – getParticipants / onParticipantJoined). */
export const SessionParticipantsPayloadSchema = z.object({
  participants: z.array(ParticipantDTOSchema),
  participantCount: z.number(),
});
export type SessionParticipantsPayload = z.infer<typeof SessionParticipantsPayloadSchema>;

/** DTO: Leaderboard-Eintrag (Story 4.1) */
export const LeaderboardEntryDTOSchema = z.object({
  rank: z.number(),
  nickname: z.string(),
  totalScore: z.number(),        // Gesamtpunkte (Schwierigkeit × Zeitbonus)
  correctCount: z.number(),      // Anzahl richtiger Antworten
  totalQuestions: z.number(),     // Gesamtanzahl Fragen
  totalResponseTimeMs: z.number(), // Gesamtantwortzeit in ms (Tiebreaker)
});
export type LeaderboardEntryDTO = z.infer<typeof LeaderboardEntryDTOSchema>;

/** DTO: Persönliche Scorecard nach jeder Frage (Story 5.6) */
export const PersonalScorecardDTOSchema = z.object({
  questionOrder: z.number(),         // Frage-Nr. (1-basiert)
  wasCorrect: z.boolean().nullable(), // null bei SURVEY/FREETEXT
  correctAnswerIds: z.array(z.uuid()).optional(), // Korrekte Antwort-IDs (bei Falsch)
  questionScore: z.number(),         // Punkte für diese Frage (inkl. Streak)
  baseScore: z.number(),             // Punkte vor Streak-Multiplikator
  streakCount: z.number(),           // Aktuelle Serie
  streakMultiplier: z.number(),      // Angewandter Streak-Faktor
  currentRank: z.number(),           // Aktueller Rang
  previousRank: z.number().nullable(), // Rang nach vorheriger Frage (null bei 1. Frage)
  rankChange: z.number(),            // Differenz (positiv = aufgestiegen)
  totalScore: z.number(),            // Gesamtpunktzahl bisher
  bonusToken: z.string().nullable().optional(), // Story 4.6: Token-Code (nur für Top-X, sonst null)
});
export type PersonalScorecardDTO = z.infer<typeof PersonalScorecardDTOSchema>;

/** DTO: Team-Leaderboard-Eintrag (Story 7.1) */
export const TeamLeaderboardEntryDTOSchema = z.object({
  rank: z.number(),
  teamName: z.string(),
  teamColor: z.string().nullable(),
  totalScore: z.number(),           // Summe aller Mitglieder-Scores
  memberCount: z.number(),
  averageScore: z.number(),         // Durchschnitt pro Mitglied
});
export type TeamLeaderboardEntryDTO = z.infer<typeof TeamLeaderboardEntryDTOSchema>;

/** Input: Emoji-Reaktion senden (Story 5.8) */
export const SendEmojiReactionInputSchema = z.object({
  sessionId: z.uuid(),
  questionId: z.uuid(),
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

/** Event der health.ping-Subscription (Story 0.2) */
export const HealthPingEventSchema = z.object({
  heartbeat: z.string(), // ISO-8601
});
export type HealthPingEvent = z.infer<typeof HealthPingEventSchema>;

export type ServerStatsDTO = z.infer<typeof ServerStatsDTOSchema>;

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
  ratingMin: z.number().nullable().optional(),           // Nur bei RATING
  ratingMax: z.number().nullable().optional(),           // Nur bei RATING
  ratingLabelMin: z.string().nullable().optional(),      // Nur bei RATING
  ratingLabelMax: z.string().nullable().optional(),      // Nur bei RATING
});

/** Schema für das gesamte Quiz-Export-Format */
export const QuizExportSchema = z.object({
  exportVersion: z.number().int().min(1),
  exportedAt: z.string(),         // ISO-8601 Timestamp
  quiz: z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
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
  token: z.string(),               // z.B. "BNS-A3F7-K2M9"
  nickname: z.string(),            // Pseudonym (Snapshot)
  quizName: z.string(),            // Quiz-Name (Snapshot)
  totalScore: z.number(),          // Erreichte Gesamtpunktzahl
  rank: z.number(),                // Platzierung (1-basiert)
  generatedAt: z.string(),         // ISO-8601 Timestamp
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
  questionTextShort: z.string(),       // z. B. erste 100 Zeichen des Fragenstamms
  type: QuestionTypeEnum,
  participantCount: z.number(),        // Anzahl abgegebener Votes für diese Frage
  optionDistribution: z.array(OptionDistributionEntrySchema).optional(), // MC/SC
  freetextAggregates: z.array(FreetextAggregateEntrySchema).optional(), // FREETEXT
  ratingDistribution: z.record(z.string(), z.number()).optional(),       // RATING: "1" -> 5, "2" -> 12
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
  finishedAt: z.string(),             // ISO-8601
  participantCount: z.number(),
  questions: z.array(QuestionExportEntrySchema),
  bonusTokens: z.array(BonusTokenEntryDTOSchema).optional(), // optional einbeziehen (Pseudonyme)
});
export type SessionExportDTO = z.infer<typeof SessionExportDTOSchema>;

// ---------------------------------------------------------------------------
// Q&A-Modus (Epic 8)
// ---------------------------------------------------------------------------

/** DTO: Eine Q&A-Frage */
export const QaQuestionDTOSchema = z.object({
  id: z.uuid(),
  text: z.string(),
  upvoteCount: z.number(),
  status: QaQuestionStatusEnum,
  createdAt: z.string(),          // ISO-8601
  hasUpvoted: z.boolean(),        // Hat der aktuelle Student bereits gevotet?
});
export type QaQuestionDTO = z.infer<typeof QaQuestionDTOSchema>;

/** Input: Q&A-Frage einreichen (Story 8.2) */
export const SubmitQaQuestionInputSchema = z.object({
  sessionId: z.uuid(),
  text: z.string().min(1).max(500),
});
export type SubmitQaQuestionInput = z.infer<typeof SubmitQaQuestionInputSchema>;

/** Input: Q&A-Frage upvoten (Story 8.3) */
export const UpvoteQaQuestionInputSchema = z.object({
  questionId: z.uuid(),
});
export type UpvoteQaQuestionInput = z.infer<typeof UpvoteQaQuestionInputSchema>;

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
  YES_NO:            { label: 'Ja / Nein',              answers: ['Ja', 'Nein'] },
  YES_NO_MAYBE:      { label: 'Ja / Nein / Vielleicht', answers: ['Ja', 'Nein', 'Vielleicht'] },
  YES_NO_DONT_KNOW:  { label: 'Ja / Nein / Weiß nicht', answers: ['Ja', 'Nein', 'Weiß nicht'] },
  TRUE_FALSE:        { label: 'Wahr / Falsch',          answers: ['Wahr', 'Falsch'] },
  ABCD:              { label: 'A / B / C / D',          answers: ['A', 'B', 'C', 'D'] },
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
    readingPhaseEnabled: false,    // Story 2.6: Schnelles Spieltempo
  },
  SERIOUS: {
    showLeaderboard: false,
    enableSoundEffects: false,
    enableRewardEffects: false,
    enableMotivationMessages: false,
    enableEmojiReactions: false,
    anonymousMode: true,
    defaultTimer: null,          // Offene Antwortphase (kein Countdown)
    readingPhaseEnabled: true,    // Story 2.6: Frage zuerst lesen
  },
};

// ---------------------------------------------------------------------------
// Preset-Export / Import (Story 1.15)
// ---------------------------------------------------------------------------

/** Aktuelle Export-Schema-Version für Preset-Dateien */
export const PRESET_EXPORT_VERSION = 1;

export const NameModeEnum = z.enum([
  'nicknameTheme',
  'allowCustomNicknames',
  'anonymousMode',
]);
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

export const QuickFeedbackTypeEnum = z.enum(['MOOD', 'ABCD', 'YESNO']);
export type QuickFeedbackType = z.infer<typeof QuickFeedbackTypeEnum>;

export const MoodValueEnum = z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']);
export type MoodValue = z.infer<typeof MoodValueEnum>;

export const AbcdValueEnum = z.enum(['A', 'B', 'C', 'D']);
export type AbcdValue = z.infer<typeof AbcdValueEnum>;

export const YesNoValueEnum = z.enum(['YES', 'NO', 'MAYBE']);
export type YesNoValue = z.infer<typeof YesNoValueEnum>;

export const QuickFeedbackThemeEnum = z.enum(['system', 'dark', 'light']);
export const QuickFeedbackPresetEnum = z.enum(['serious', 'spielerisch']);

export const CreateQuickFeedbackInputSchema = z.object({
  type: QuickFeedbackTypeEnum,
  theme: QuickFeedbackThemeEnum,
  preset: QuickFeedbackPresetEnum,
});
export type CreateQuickFeedbackInput = z.infer<typeof CreateQuickFeedbackInputSchema>;

export const UpdateQuickFeedbackStyleInputSchema = z.object({
  sessionCode: z.string(),
  theme: QuickFeedbackThemeEnum,
  preset: QuickFeedbackPresetEnum,
});
export type UpdateQuickFeedbackStyleInput = z.infer<typeof UpdateQuickFeedbackStyleInputSchema>;

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
