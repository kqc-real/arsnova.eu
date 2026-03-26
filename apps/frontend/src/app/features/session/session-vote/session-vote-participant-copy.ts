/**
 * Teilnehmer-Vote: Texte abhängig vom Preset (Session → Theme).
 * Ernst: sachlich, klar. Spielerisch: Duzen, leichte Energie, ohne die Aufgabe zu verwässern.
 */
export function voteLiveBannerCodeLabel(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.liveCodePlayful:Euer Code`;
  }
  return $localize`:@@sessionVote.liveCodeSerious:Session-Code`;
}

export function voteLiveBannerParticipantsLabel(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.liveParticipantsPlayful:Mit dabei`;
  }
  return $localize`:@@sessionVote.liveParticipantsSerious:Teilnehmende`;
}

export function voteLobbyBadge(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.lobbyBadgePlayful:Bist dabei – klasse!`;
  }
  return $localize`:@@sessionVote.lobbyBadgeSerious:Du bist dabei`;
}

export function voteLobbyWaitTitle(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.lobbyWaitTitlePlayful:Gleich geht's los – mach dich bereit!`;
  }
  return $localize`:@@sessionVote.lobbyWaitTitleSerious:Warte auf den Start durch den Dozenten`;
}

export function voteLobbyHintQuiz(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.lobbyHintQuizPlayful:Die erste Frage landet gleich hier – bleib online!`;
  }
  return $localize`:@@sessionVote.lobbyHintQuizSerious:Die erste Frage erscheint automatisch – Gerät bereithalten.`;
}

export function voteLobbyHintQa(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.lobbyHintQaPlayful:Die Fragerunde startet automatisch – bleib einfach hier, wir aktualisieren für dich.`;
  }
  return $localize`:@@sessionVote.lobbyHintQaSerious:Die Fragerunde startet automatisch. Halte diese Seite offen.`;
}

export function voteQaActiveTitle(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.qaActiveTitlePlayful:Fragerunde live!`;
  }
  return $localize`:@@sessionVote.qaActiveTitleSerious:Fragerunde läuft`;
}

export function voteQaActiveHint(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.qaActiveHintPlayful:Du bist drin – neue Infos kommen automatisch, du musst nichts tun.`;
  }
  return $localize`:@@sessionVote.qaActiveHintSerious:Du bist verbunden. Neue Inhalte erscheinen hier automatisch.`;
}

export function voteFinishedHeroTitle(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.finishedTitlePlayful:Geschafft – toll mitgemacht!`;
  }
  return $localize`:@@sessionVote.finishedTitleSerious:Session beendet`;
}

export function voteFinishedRankLabel(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.finishedRankPlayful:Rang`;
  }
  return $localize`:@@sessionVote.finishedRankSerious:Platz`;
}

export function voteFinishedPointsLabel(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.finishedPointsPlayful:Deine Punkte`;
  }
  return $localize`:@@sessionVote.finishedPointsSerious:Punkte`;
}

export function voteBackHomeCta(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.backHomePlayful:Zurück zur Startseite`;
  }
  return $localize`:@@sessionVote.backHomeSerious:Zur Startseite`;
}

export function voteTeamEyebrow(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.teamEyebrowPlayful:Euer Team`;
  }
  return $localize`:@@sessionVote.teamEyebrowSerious:Dein Team`;
}

export function voteTeamStatRank(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.teamStatRankPlayful:Team-Rang`;
  }
  return $localize`:@@sessionVote.teamStatRankSerious:Teamrang`;
}

export function voteTeamStatPoints(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.teamStatPointsPlayful:Team-Punkte`;
  }
  return $localize`:@@sessionVote.teamStatPointsSerious:Team-Punkte`;
}

export function voteTeamStatMembers(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.teamStatMembersPlayful:Mitspieler:innen`;
  }
  return $localize`:@@sessionVote.teamStatMembersSerious:Mitglieder`;
}

export function voteBonusTitle(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.bonusTitlePlayful:Dein Extra-Code`;
  }
  return $localize`:@@sessionVote.bonusTitleSerious:Dein Bonus-Code`;
}

export function voteBonusCopyCta(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.bonusCopyPlayful:Code kopieren`;
  }
  return $localize`:@@sessionVote.bonusCopySerious:Code kopieren`;
}

export function voteBonusHint(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.bonusHintPlayful:Schick den Code per Mail an deine Lehrperson, wenn du Bonuspunkte willst. Du bleibst anonym, bis du ihn einreichst.`;
  }
  return $localize`:@@sessionVote.bonusHintSerious:Sende diesen Code per E-Mail an deinen Dozenten, um Bonuspunkte zu erhalten. Deine Anonymität bleibt gewahrt, solange du den Code nicht einreichst.`;
}

export function voteFeedbackTitle(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.feedbackTitlePlayful:Kurzes Feedback?`;
  }
  return $localize`:@@sessionVote.feedbackTitleSerious:Deine Meinung zählt`;
}

export function voteFeedbackLegendOverall(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.feedbackOverallPlayful:Wie war's insgesamt?`;
  }
  return $localize`:@@sessionVote.feedbackOverallSerious:Wie hat dir das Quiz gefallen?`;
}

export function voteFeedbackLegendQuality(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.feedbackQualityPlayful:Fragen – fair und klar?`;
  }
  return $localize`:@@sessionVote.feedbackQualitySerious:Qualität der Fragen?`;
}

export function voteFeedbackLegendRepeat(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.feedbackRepeatPlayful:Noch eine Runde?`;
  }
  return $localize`:@@sessionVote.feedbackRepeatSerious:Nochmal mitmachen?`;
}

export function voteFeedbackRepeatYes(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.feedbackYesPlayful:Ja, klar!`;
  }
  return $localize`:@@sessionVote.feedbackYesSerious:Ja, gerne`;
}

export function voteFeedbackRepeatNo(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.feedbackNoPlayful:Eher nicht`;
  }
  return $localize`:@@sessionVote.feedbackNoSerious:Eher nicht`;
}

export function voteFeedbackSubmit(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.feedbackSubmitPlayful:Absenden!`;
  }
  return $localize`:@@sessionVote.feedbackSubmitSerious:Bewertung absenden`;
}

export function voteFeedbackAriaOverall(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.fbAriaOverallPlayful:Gesamt – wie war's?`;
  }
  return $localize`:@@sessionVote.fbAriaOverallSerious:Gesamtbewertung`;
}

export function voteFeedbackAriaQuality(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.fbAriaQualityPlayful:Fragenqualität`;
  }
  return $localize`:@@sessionVote.fbAriaQualitySerious:Fragenqualität`;
}

export function voteFeedbackAriaRepeat(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.fbAriaRepeatPlayful:Nochmal mitmachen?`;
  }
  return $localize`:@@sessionVote.fbAriaRepeatSerious:Nochmal mitmachen?`;
}

export function voteFeedbackAriaRepeatYes(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.fbAriaRepeatYesPlayful:Ja, unbedingt`;
  }
  return $localize`:@@sessionVote.fbAriaRepeatYesSerious:Ja, gerne wieder`;
}

export function voteFeedbackAriaRepeatNo(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.fbAriaRepeatNoPlayful:Eher nicht`;
  }
  return $localize`:@@sessionVote.fbAriaRepeatNoSerious:Eher nicht`;
}

export function voteFeedbackDoneTitle(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.feedbackDoneTitlePlayful:Danke – ist angekommen!`;
  }
  return $localize`:@@sessionVote.feedbackDoneTitleSerious:Danke für dein Feedback`;
}

export function voteFeedbackDoneCount(playful: boolean, total: number): string {
  if (playful) {
    return $localize`:@@sessionVote.feedbackDoneCountPlayful:${total}:count: Stimmen insgesamt`;
  }
  return $localize`:@@sessionVote.feedbackDoneCountSerious:${total}:count: Bewertungen insgesamt`;
}

export function voteQuestionLabel(playful: boolean, displayNumber: number): string {
  if (playful) {
    return $localize`:@@sessionVote.questionLabelPlayful:Runde ${displayNumber}:n:`;
  }
  return $localize`:@@sessionVote.questionLabelSerious:Frage ${displayNumber}:n:`;
}

export function voteLastQuestionBadge(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.lastQuestionPlayful:Finale Frage`;
  }
  return $localize`:@@sessionVote.lastQuestionSerious:Letzte Frage`;
}

export function voteReadingTitle(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.readingTitlePlayful:Erst lesen, dann abstimmen`;
  }
  return $localize`:@@sessionVote.readingTitleSerious:Lesephase`;
}

export function voteReadingHint(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.readingHintPlayful:Nimm dir einen Moment – die Antworten kommen gleich.`;
  }
  return $localize`:@@sessionVote.readingHintSerious:Lies die Frage in Ruhe – die Antwortoptionen folgen gleich.`;
}

export function voteDiscussionTitle(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.discussionTitlePlayful:Schnell mit dem Nachbarn sprechen`;
  }
  return $localize`:@@sessionVote.discussionTitleSerious:Tausch dich kurz mit deinem Nachbarn aus`;
}

export function voteDiscussionHint(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.discussionHintPlayful:Gleiche Meinung? Super. Unterschiedlich? Kurz austauschen – dann geht's in Runde 2.`;
  }
  return $localize`:@@sessionVote.discussionHintSerious:Gleiche Antwort? Prima. Verschiedene Meinung? Überzeugt euch gegenseitig.`;
}

export function voteDiscussionNext(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.discussionNextPlayful:Gleich geht's in die zweite Runde…`;
  }
  return $localize`:@@sessionVote.discussionNextSerious:Zweite Abstimmung folgt gleich…`;
}

export function voteRound2Banner(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.round2BannerPlayful:Runde 2 – hat sich deine Meinung nach dem Gespräch geändert?`;
  }
  return $localize`:@@sessionVote.round2BannerSerious:2. Runde – hat die Diskussion deine Meinung geändert?`;
}

export function voteRoundBadge(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.roundBadgePlayful:2. Runde`;
  }
  return $localize`:@@sessionVote.roundBadgeSerious:2. Runde`;
}

export function voteAllVotedLabel(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.allVotedPlayful:Alle Stimmen sind da`;
  }
  return $localize`:@@sessionVote.allVotedSerious:Alle haben abgestimmt`;
}

export function voteSubmitCta(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.submitPlayful:Absenden!`;
  }
  return $localize`:@@sessionVote.submitSerious:Absenden`;
}

export function voteFreetextPlaceholder(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.freetextPhPlayful:Deine Idee …`;
  }
  return $localize`:@@sessionVote.freetextPhSerious:Deine Antwort…`;
}

export function voteFreetextOwnPrefix(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.freetextOwnPlayful:Du sagst:`;
  }
  return $localize`:@@sessionVote.freetextOwnSerious:Deine Antwort:`;
}

export function voteFreetextEmpty(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.freetextEmptyPlayful:Diese Runde ohne Text – nächste Chance wartet.`;
  }
  return $localize`:@@sessionVote.freetextEmptySerious:Keine Antwort abgegeben.`;
}

export function voteRatingResultPrefix(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.ratingResultPrefixPlayful:Deine Wahl:`;
  }
  return $localize`:@@sessionVote.ratingResultPrefixSerious:Deine Bewertung:`;
}

export function voteSentLabel(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.sentPlayful:Antwort gesendet!`;
  }
  return $localize`:@@sessionVote.sentSerious:Antwort gesendet`;
}

export function voteRewardCorrect(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.rewardCorrectPlayful:🎉 Volltreffer!`;
  }
  return $localize`:@@sessionVote.rewardCorrectSerious:🎉 Richtig!`;
}

export function voteScorecardHeading(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.scorecardHeadingPlayful:Dein Score`;
  }
  return $localize`:@@sessionVote.scorecardHeadingSerious:Dein Ergebnis`;
}

export function voteScorecardHint(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.scorecardHintPlayful:Nur du siehst das hier.`;
  }
  return $localize`:@@sessionVote.scorecardHintSerious:Nur für dich sichtbar.`;
}

export function voteScorecardCorrect(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.scoreCorrectPlayful:✓ Top!`;
  }
  return $localize`:@@sessionVote.scoreCorrectSerious:✓ Richtig`;
}

export function voteScorecardWrong(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.scoreWrongPlayful:✗ Leider daneben`;
  }
  return $localize`:@@sessionVote.scoreWrongSerious:✗ Falsch`;
}

export function voteScorecardNeutral(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.scoreNeutralPlayful:Notiert!`;
  }
  return $localize`:@@sessionVote.scoreNeutralSerious:Antwort registriert`;
}

export function voteEmojiBarLabel(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.emojiLabelPlayful:Schnell reagieren`;
  }
  return $localize`:@@sessionVote.emojiLabelSerious:Schnell reagieren`;
}

export function voteEmojiBarHint(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.emojiHintPlayful:Tippe ein Emoji – es erscheint anonym beim Dozenten (wenn aktiv).`;
  }
  return $localize`:@@sessionVote.emojiHintSerious:Tippe auf ein Symbol – deine Reaktion erscheint anonym beim Dozenten (optional).`;
}

export function voteEmojiSent(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.emojiSentPlayful:Emoji gesendet!`;
  }
  return $localize`:@@sessionVote.emojiSentSerious:Reaktion gesendet`;
}

export function voteLobbyLoading(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.lobbyLoadingPlayful:Nur noch einen Moment…`;
  }
  return $localize`:@@sessionVote.lobbyLoadingSerious:Einen Moment…`;
}

export function voteQaFormLabel(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.qaFormLabelPlayful:Deine Frage in den Raum`;
  }
  return $localize`:@@sessionVote.qaFormLabelSerious:Deine Frage`;
}

export function voteQaPlaceholder(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.qaPlaceholderPlayful:Stell deine Frage – kurz und klar`;
  }
  return $localize`:@@sessionVote.qaPlaceholderSerious:Schreibe deine Frage hier`;
}

export function voteQaSubmit(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.qaSubmitPlayful:Frage stellen`;
  }
  return $localize`:@@sessionVote.qaSubmitSerious:Frage senden`;
}

export function voteQaEmpty(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.qaEmptyPlayful:Noch leer – stell als Erste:r eine Frage!`;
  }
  return $localize`:@@sessionVote.qaEmptySerious:Noch keine Fragen – stell die erste!`;
}

export function voteQaOwnBadge(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.qaOwnBadgePlayful:Von dir`;
  }
  return $localize`:@@sessionVote.qaOwnBadgeSerious:Deine Frage`;
}

export function voteQaModerationNotice(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.qaModerationPlayful:Deine Frage schauen wir kurz an, bevor sie live geht.`;
  }
  return $localize`:@@sessionVote.qaModerationSerious:Deine Fragen werden vor der Veröffentlichung geprüft.`;
}

export function voteFeedbackSnack(playful: boolean): string {
  if (playful) {
    return $localize`:@@sessionVote.feedbackSnackPlayful:Feedback gelandet – danke!`;
  }
  return $localize`:@@sessionVote.feedbackSnackSerious:Danke für dein Feedback!`;
}

export function voteTeamLeaderHintPlayful(leaderName: string, leaderScore: number): string {
  return $localize`:@@sessionVote.teamLeaderHintPlayful:Vorne liegt ${leaderName}:name: mit ${leaderScore}:score: Punkten – bleibt dran!`;
}

export function voteTeamLeaderHintSerious(leaderName: string, leaderScore: number): string {
  return $localize`:@@sessionVote.teamLeaderHintSerious:Vorne liegt ${leaderName}:name: mit ${leaderScore}:score: Punkten.`;
}
