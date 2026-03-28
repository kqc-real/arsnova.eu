import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { trpc } from '../../core/trpc.client';
import { renderMarkdownWithoutKatex } from '../../shared/markdown-katex.util';

export type AdminMotdTemplateDialogData = { templateId: string | null };

@Component({
  selector: 'app-admin-motd-template-dialog',
  standalone: true,
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatProgressSpinner,
  ],
  templateUrl: './admin-motd-template-dialog.component.html',
  styleUrl: './admin-motd-template-dialog.component.scss',
})
export class AdminMotdTemplateDialogComponent implements OnInit {
  private readonly sanitizer = inject(DomSanitizer);
  readonly dialogRef = inject(MatDialogRef<AdminMotdTemplateDialogComponent, boolean>);
  readonly data = inject<AdminMotdTemplateDialogData>(MAT_DIALOG_DATA);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly tplName = signal('');
  readonly tplDescription = signal('');
  readonly tplMdDe = signal('');
  readonly tplMdEn = signal('');
  readonly tplMdFr = signal('');
  readonly tplMdEs = signal('');
  readonly tplMdIt = signal('');

  /** Live aus DE (Fallback EN); `innerHTML` liegt außerhalb des Encapsulation-Scopes → Typo in `styles.scss`. */
  readonly previewHtml = computed<SafeHtml>(() => {
    const raw = this.tplMdDe().trim() || this.tplMdEn().trim() || '…';
    const html = renderMarkdownWithoutKatex(raw);
    return this.sanitizer.bypassSecurityTrustHtml(html);
  });

  readonly isEdit = (): boolean => this.data.templateId !== null;

  async ngOnInit(): Promise<void> {
    const id = this.data.templateId;
    if (!id) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const t = await trpc.admin.motd.templateGet.query({ id });
      this.tplName.set(t.name);
      this.tplDescription.set(t.description ?? '');
      this.tplMdDe.set(t.markdownDe);
      this.tplMdEn.set(t.markdownEn);
      this.tplMdFr.set(t.markdownFr);
      this.tplMdEs.set(t.markdownEs);
      this.tplMdIt.set(t.markdownIt);
    } catch (e) {
      this.error.set(
        this.msg(e, $localize`:@@admin.motd.errorTplLoad:Vorlage konnte nicht geladen werden.`),
      );
    } finally {
      this.loading.set(false);
    }
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    const name = this.tplName().trim();
    if (!name) {
      this.error.set($localize`:@@admin.motd.errorTplName:Bitte einen Anzeigenamen eingeben.`);
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const desc = this.tplDescription().trim();
    const body = {
      name,
      description: desc.length > 0 ? desc : undefined,
      markdownDe: this.tplMdDe(),
      markdownEn: this.tplMdEn(),
      markdownFr: this.tplMdFr(),
      markdownEs: this.tplMdEs(),
      markdownIt: this.tplMdIt(),
    };
    try {
      const id = this.data.templateId;
      if (id) {
        await trpc.admin.motd.templateUpdate.mutate({
          id,
          name: body.name,
          description: desc.length > 0 ? desc : null,
          markdownDe: body.markdownDe,
          markdownEn: body.markdownEn,
          markdownFr: body.markdownFr,
          markdownEs: body.markdownEs,
          markdownIt: body.markdownIt,
        });
      } else {
        await trpc.admin.motd.templateCreate.mutate(body);
      }
      this.dialogRef.close(true);
    } catch (e) {
      this.error.set(
        this.msg(e, $localize`:@@admin.motd.errorTplSave:Vorlage konnte nicht gespeichert werden.`),
      );
    } finally {
      this.saving.set(false);
    }
  }

  private msg(e: unknown, fallback: string): string {
    if (
      e &&
      typeof e === 'object' &&
      'message' in e &&
      typeof (e as { message: string }).message === 'string'
    ) {
      return (e as { message: string }).message;
    }
    return fallback;
  }
}
