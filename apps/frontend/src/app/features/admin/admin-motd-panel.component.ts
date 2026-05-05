import {
  Component,
  ElementRef,
  LOCALE_ID,
  OnInit,
  QueryList,
  ViewChildren,
  inject,
  isDevMode,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MatCard,
  MatCardContent,
  MatCardHeader,
  MatCardSubtitle,
  MatCardTitle,
} from '@angular/material/card';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormField, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSelect, MatOption } from '@angular/material/select';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import type {
  AdminMotdDetailDTO,
  AdminMotdInteractionStats,
  AdminMotdListItemDTO,
  AdminMotdTemplateListItemDTO,
} from '@arsnova/shared-types';
import { firstValueFrom } from 'rxjs';
import {
  formatMotdAdminDateTimeForDisplay,
  formatMotdEndsAtForDisplay,
} from '../../core/motd-ends-display';
import { trpc } from '../../core/trpc.client';
import { localizeKnownServerError } from '../../core/localize-known-server-message';
import { resolveMotdAssetOrigin } from '../../core/motd-asset-origin';
import {
  absolutizeMarkdownHtmlRootAssetImgSrc,
  renderMarkdownWithoutKatex,
} from '../../shared/markdown-katex.util';
import { MarkdownImageLightboxDirective } from '../../shared/markdown-image-lightbox/markdown-image-lightbox.directive';
import { AdminMotdTemplateDialogComponent } from './admin-motd-template-dialog.component';

const ADMIN_MOTD_DATE_LOCALE: Record<string, string> = {
  de: 'de-DE',
  en: 'en-GB',
  fr: 'fr-FR',
  es: 'es-ES',
  it: 'it-IT',
};

@Component({
  selector: 'app-admin-motd-panel',
  standalone: true,
  imports: [
    FormsModule,
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardTitle,
    MatCardSubtitle,
    MatButton,
    MatProgressSpinner,
    MatFormField,
    MatLabel,
    MatSuffix,
    MatInput,
    MatSelect,
    MatOption,
    MatCheckbox,
    MatDatepickerModule,
    MatTimepickerModule,
    MatExpansionModule,
    MatTooltipModule,
    MarkdownImageLightboxDirective,
  ],
  templateUrl: './admin-motd-panel.component.html',
  styleUrl: './admin-motd-panel.component.scss',
})
export class AdminMotdPanelComponent implements OnInit {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly dialog = inject(MatDialog);
  private readonly appLocaleId = inject(LOCALE_ID);

  /** MOTD-Markdown-Textareas: vor „Speichern“ DOM → Signal, falls NgModel hinter dem sichtbaren Text hängt. */
  @ViewChildren('motdMdTa') private readonly motdMdTextareas!: QueryList<
    ElementRef<HTMLTextAreaElement>
  >;

  /** Hinweis zu `seed:dev-motd` nur lokal — in Produktion nicht anzeigen. */
  readonly showDevMotdSeedHint = isDevMode();

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly info = signal<string | null>(null);
  readonly motds = signal<AdminMotdListItemDTO[]>([]);
  readonly templates = signal<AdminMotdTemplateListItemDTO[]>([]);

  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  /** Aggregierte Nutzerreaktionen zur aktuell bearbeiteten MOTD (aus get/save/list). */
  readonly motdInteractionStats = signal<AdminMotdInteractionStats | null>(null);
  readonly resettingMotdStats = signal(false);

  readonly status = signal<'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED'>('DRAFT');
  readonly priority = signal(0);
  /** Lokale DateTime für Start/Ende (Kalender + Uhrzeit) */
  readonly startAt = signal<Date | null>(null);
  readonly endAt = signal<Date | null>(null);
  readonly visibleInArchive = signal(false);
  readonly templateId = signal<string>('');
  readonly mdDe = signal('');
  readonly mdEn = signal('');
  readonly mdFr = signal('');
  readonly mdEs = signal('');
  readonly mdIt = signal('');

  readonly previewHtml = signal<SafeHtml | null>(null);

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [mList, tList] = await Promise.all([
        trpc.admin.motd.motdList.query(),
        trpc.admin.motd.templateList.query(),
      ]);
      this.motds.set(mList);
      this.templates.set(tList);
      this.syncInteractionStatsFromList();
    } catch (e) {
      this.error.set(
        this.msg(e, $localize`:@@admin.motd.errorLoad:MOTD-Liste konnte nicht geladen werden.`),
      );
    } finally {
      this.loading.set(false);
    }
  }

  /** Listenansicht: Start in App-Locale (wie Ende, ohne Roh-ISO `2026-03-27T14:41`). */
  formatMotdListStartsAt(iso: string): string {
    const bcp = ADMIN_MOTD_DATE_LOCALE[String(this.appLocaleId)] ?? 'de-DE';
    return formatMotdAdminDateTimeForDisplay(iso, bcp);
  }

  /** Listenansicht: Ende ohne Jahreszahl 2099 als „Fortlaufend“ (siehe `motd-ends-display`). */
  formatMotdListEndsAt(iso: string): string {
    const bcp = ADMIN_MOTD_DATE_LOCALE[String(this.appLocaleId)] ?? 'de-DE';
    return formatMotdEndsAtForDisplay(iso, bcp, 'admin');
  }

  /** Textvorlagen-Liste: `updatedAt` konsistent zur MOTD-Liste. */
  formatTplUpdatedAt(iso: string): string {
    const bcp = ADMIN_MOTD_DATE_LOCALE[String(this.appLocaleId)] ?? 'de-DE';
    return formatMotdAdminDateTimeForDisplay(iso, bcp);
  }

  newMotd(): void {
    this.editingId.set(null);
    this.status.set('DRAFT');
    this.priority.set(0);
    const now = new Date();
    const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    this.startAt.set(now);
    this.endAt.set(week);
    this.visibleInArchive.set(false);
    this.templateId.set('');
    this.mdDe.set('');
    this.mdEn.set('');
    this.mdFr.set('');
    this.mdEs.set('');
    this.mdIt.set('');
    this.previewHtml.set(null);
    this.info.set(null);
    this.motdInteractionStats.set(null);
  }

  async editMotd(id: string): Promise<void> {
    this.error.set(null);
    this.info.set(null);
    try {
      const d: AdminMotdDetailDTO = await trpc.admin.motd.motdGet.query({ id });
      this.editingId.set(d.id);
      this.status.set(d.status);
      this.priority.set(Math.min(this.motdPriorityMax, Math.max(this.motdPriorityMin, d.priority)));
      this.startAt.set(new Date(d.startsAt));
      this.endAt.set(new Date(d.endsAt));
      this.visibleInArchive.set(d.visibleInArchive);
      this.templateId.set(d.templateId ?? '');
      this.mdDe.set(d.locales.de);
      this.mdEn.set(d.locales.en);
      this.mdFr.set(d.locales.fr);
      this.mdEs.set(d.locales.es);
      this.mdIt.set(d.locales.it);
      this.motdInteractionStats.set(d.interaction);
      this.updatePreview();
    } catch (e) {
      this.error.set(
        this.msg(e, $localize`:@@admin.motd.errorGet:MOTD konnte nicht geladen werden.`),
      );
    }
  }

  /** Zurücksetzen der Server-Zähler für eine MOTD (Liste oder Formular „Bearbeitung“). */
  async resetMotdInteractionStatsById(motdId: string): Promise<void> {
    if (this.resettingMotdStats()) {
      return;
    }
    if (
      !globalThis.confirm(
        $localize`:@@admin.motd.confirmResetStats:Nutzerreaktionen (Zähler) für diese Meldung auf null setzen?`,
      )
    ) {
      return;
    }
    this.error.set(null);
    this.resettingMotdStats.set(true);
    try {
      const d = await trpc.admin.motd.motdResetInteractionStats.mutate({ id: motdId });
      if (this.editingId() === motdId) {
        this.motdInteractionStats.set(d.interaction);
      }
      this.info.set($localize`:@@admin.motd.resetStatsDone:Nutzerreaktionen zurückgesetzt.`);
      await this.reload();
    } catch (e) {
      this.error.set(
        this.msg(
          e,
          $localize`:@@admin.motd.errorResetStats:Zähler konnten nicht zurückgesetzt werden.`,
        ),
      );
    } finally {
      this.resettingMotdStats.set(false);
    }
  }

  async resetMotdInteractionStats(): Promise<void> {
    const id = this.editingId();
    if (!id) {
      return;
    }
    await this.resetMotdInteractionStatsById(id);
  }

  async deleteMotd(id: string): Promise<void> {
    if (!globalThis.confirm($localize`:@@admin.motd.confirmDelete:MOTD wirklich löschen?`)) {
      return;
    }
    this.error.set(null);
    try {
      await trpc.admin.motd.motdDelete.mutate({ id });
      this.info.set($localize`:@@admin.motd.deleted:MOTD gelöscht.`);
      if (this.editingId() === id) {
        this.newMotd();
      }
      await this.reload();
    } catch (e) {
      this.error.set(
        this.msg(e, $localize`:@@admin.motd.errorDelete:MOTD konnte nicht gelöscht werden.`),
      );
    }
  }

  async saveMotd(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.info.set(null);
    try {
      this.syncMotdMarkdownSignalsFromDom();
      const locales = {
        de: this.mdDe(),
        en: this.mdEn(),
        fr: this.mdFr(),
        es: this.mdEs(),
        it: this.mdIt(),
      };
      const s = this.startAt();
      const e = this.endAt();
      if (!s || !e) {
        this.error.set(
          $localize`:@@admin.motd.errorDateMissing:Bitte Start und Ende vollständig angeben.`,
        );
        return;
      }
      if (e.getTime() <= s.getTime()) {
        this.error.set(
          $localize`:@@admin.motd.errorEndBeforeStart:Ende muss nach dem Start liegen.`,
        );
        return;
      }
      const startsAt = s.toISOString();
      const endsAt = e.toISOString();
      const id = this.editingId();
      if (id) {
        const updated = await trpc.admin.motd.motdUpdate.mutate({
          id,
          status: this.status(),
          priority: this.priority(),
          startsAt,
          endsAt,
          visibleInArchive: this.visibleInArchive(),
          templateId: this.templateId() || undefined,
          locales,
        });
        this.motdInteractionStats.set(updated.interaction);
        this.info.set($localize`:@@admin.motd.saved:MOTD gespeichert.`);
      } else {
        const created = await trpc.admin.motd.motdCreate.mutate({
          status: this.status(),
          priority: this.priority(),
          startsAt,
          endsAt,
          visibleInArchive: this.visibleInArchive(),
          templateId: this.templateId() || undefined,
          locales,
        });
        this.editingId.set(created.id);
        this.motdInteractionStats.set(created.interaction);
        this.info.set($localize`:@@admin.motd.created:MOTD angelegt.`);
      }
      await this.reload();
    } catch (e) {
      this.error.set(this.msg(e, $localize`:@@admin.motd.errorSave:Speichern fehlgeschlagen.`));
    } finally {
      this.saving.set(false);
    }
  }

  /** Liest die fünf Markdown-Felder aus dem DOM in die Signals (Quelle der Wahrheit vor dem Server-Call). */
  private syncMotdMarkdownFromDom(): void {
    const list = this.motdMdTextareas;
    if (!list?.length) return;
    for (const ref of list) {
      const el = ref.nativeElement;
      const loc = el.getAttribute('data-motd-locale');
      if (!loc) continue;
      const v = el.value;
      switch (loc) {
        case 'de':
          this.mdDe.set(v);
          break;
        case 'en':
          this.mdEn.set(v);
          break;
        case 'fr':
          this.mdFr.set(v);
          break;
        case 'es':
          this.mdEs.set(v);
          break;
        case 'it':
          this.mdIt.set(v);
          break;
        default:
          break;
      }
    }
  }

  private syncMotdMarkdownSignalsFromDom(): void {
    this.syncMotdMarkdownFromDom();
    this.updatePreview();
  }

  applyTemplate(): void {
    const tid = this.templateId();
    if (!tid) return;
    this.error.set(null);
    void (async () => {
      try {
        const t = await trpc.admin.motd.templateGet.query({ id: tid });
        this.mdDe.set(t.markdownDe);
        this.mdEn.set(t.markdownEn);
        this.mdFr.set(t.markdownFr);
        this.mdEs.set(t.markdownEs);
        this.mdIt.set(t.markdownIt);
        this.updatePreview();
      } catch (e) {
        this.error.set(
          this.msg(e, $localize`:@@admin.motd.errorTemplate:Vorlage konnte nicht geladen werden.`),
        );
      }
    })();
  }

  openNewTemplateDialog(): void {
    void this.openTemplateDialog(null);
  }

  openEditTemplateDialog(id: string): void {
    void this.openTemplateDialog(id);
  }

  private async openTemplateDialog(templateId: string | null): Promise<void> {
    this.error.set(null);
    const ref = this.dialog.open(AdminMotdTemplateDialogComponent, {
      data: { templateId },
      width: 'min(42rem, calc(100vw - 1.5rem))',
      maxWidth: '100vw',
      maxHeight: 'min(92dvh, calc(100vh - 1rem))',
      autoFocus: 'first-tabbable',
      panelClass: 'admin-motd-template-dialog-panel',
      backdropClass: 'motd-archive-dialog-backdrop',
    });
    const saved = await firstValueFrom(ref.afterClosed());
    if (saved === true) {
      this.info.set(
        templateId
          ? $localize`:@@admin.motd.tplUpdated:Vorlage aktualisiert.`
          : $localize`:@@admin.motd.tplCreated:Vorlage angelegt.`,
      );
      await this.reload();
    }
  }

  async deleteTemplate(id: string): Promise<void> {
    if (!globalThis.confirm($localize`:@@admin.motd.confirmTplDelete:Vorlage wirklich löschen?`)) {
      return;
    }
    this.error.set(null);
    try {
      await trpc.admin.motd.templateDelete.mutate({ id });
      if (this.templateId() === id) {
        this.templateId.set('');
      }
      this.info.set($localize`:@@admin.motd.tplDeleted:Vorlage gelöscht.`);
      await this.reload();
    } catch (e) {
      this.error.set(
        this.msg(e, $localize`:@@admin.motd.errorTplDelete:Vorlage konnte nicht gelöscht werden.`),
      );
    }
  }

  updatePreview(): void {
    const raw = this.mdDe().trim() || this.mdEn().trim() || '…';
    const html = absolutizeMarkdownHtmlRootAssetImgSrc(
      renderMarkdownWithoutKatex(raw),
      resolveMotdAssetOrigin(),
    );
    this.previewHtml.set(this.sanitizer.bypassSecurityTrustHtml(html));
  }

  /** Wie `AdminMotdCreateInputSchema` / Update: Priorität (für Template + Clamp). */
  readonly motdPriorityMin = 0;
  readonly motdPriorityMax = 1_000_000;
  private readonly timeStepMinutes = 15;

  /** Nur setzen, wenn Start gesetzt — vermeidet ungültiges `min` am Datepicker-Input. */
  endDateMin(): Date | undefined {
    const s = this.startAt();
    return s ?? undefined;
  }

  /** Startdatum nicht nach Enddatum (Kalendertag). */
  startDateMax(): Date | undefined {
    const e = this.endAt();
    return e ?? undefined;
  }

  /** Gleicher Kalendertag in lokaler Zeit. */
  private sameLocalCalendarDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  /**
   * Ende-Uhrzeit: am selben Tag wie Start mindestens Startuhrzeit (Timepicker blendet frühere Slots aus).
   */
  endTimeMin(): Date | null {
    const s = this.startAt();
    const e = this.endAt();
    if (!s || !e || !this.sameLocalCalendarDay(s, e)) {
      return null;
    }
    return new Date(s.getTime());
  }

  /**
   * Start-Uhrzeit: am selben Tag wie Ende höchstens Enduhrzeit (frühere Startzeiten bleiben wählbar).
   */
  startTimeMax(): Date | null {
    const s = this.startAt();
    const e = this.endAt();
    if (!s || !e || !this.sameLocalCalendarDay(s, e)) {
      return null;
    }
    return new Date(e.getTime());
  }

  onPriorityInput(raw: string): void {
    const n = Number.parseInt(String(raw).replace(/\s+/g, ''), 10);
    if (!Number.isFinite(n)) {
      this.priority.set(this.motdPriorityMin);
      return;
    }
    const clamped = Math.min(this.motdPriorityMax, Math.max(this.motdPriorityMin, n));
    this.priority.set(clamped);
  }

  onStartDateModelChange(next: Date | null): void {
    if (!next) {
      this.startAt.set(null);
      return;
    }
    const cur = this.startAt();
    if (!cur) {
      this.startAt.set(new Date(next.getTime()));
      this.ensureEndAfterStart();
      return;
    }
    const d = new Date(cur);
    d.setFullYear(next.getFullYear(), next.getMonth(), next.getDate());
    this.startAt.set(d);
    this.ensureEndAfterStart();
  }

  onStartTimeModelChange(next: Date | null): void {
    if (!next) {
      this.startAt.set(null);
      return;
    }
    const cur = this.startAt();
    const d = cur ? new Date(cur) : new Date();
    d.setHours(next.getHours(), next.getMinutes(), next.getSeconds(), 0);
    this.startAt.set(d);
    this.ensureEndAfterStart();
  }

  onEndDateModelChange(next: Date | null): void {
    if (!next) {
      this.endAt.set(null);
      return;
    }
    const cur = this.endAt();
    if (!cur) {
      this.endAt.set(new Date(next.getTime()));
      this.ensureEndAfterStart();
      return;
    }
    const d = new Date(cur);
    d.setFullYear(next.getFullYear(), next.getMonth(), next.getDate());
    this.endAt.set(d);
    this.ensureEndAfterStart();
  }

  onEndTimeModelChange(next: Date | null): void {
    if (!next) {
      this.endAt.set(null);
      return;
    }
    const cur = this.endAt();
    const d = cur ? new Date(cur) : new Date();
    d.setHours(next.getHours(), next.getMinutes(), next.getSeconds(), 0);
    this.endAt.set(d);
    this.ensureEndAfterStart();
  }

  /**
   * Ende strikt nach Start; bei Verletzung Ende um ein Intervall nach vorne schieben (wie Timepicker 15m).
   */
  private ensureEndAfterStart(): void {
    const s = this.startAt();
    const e = this.endAt();
    if (!s || !e) {
      return;
    }
    if (e.getTime() > s.getTime()) {
      return;
    }
    const bump = new Date(s.getTime() + this.timeStepMinutes * 60 * 1000);
    this.endAt.set(bump);
  }

  private syncInteractionStatsFromList(): void {
    const cur = this.editingId();
    if (!cur) return;
    const row = this.motds().find((m) => m.id === cur);
    if (row) this.motdInteractionStats.set(row.interaction);
  }

  private msg(e: unknown, fallback: string): string {
    return localizeKnownServerError(e, fallback);
  }
}
