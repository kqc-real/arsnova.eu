import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { INFO_LANDING_ANCHORS } from '../../core/info-landing-url';
import { ThemePresetService } from '../../core/theme-preset.service';
import { InfoLandingLinkComponent } from './info-landing-link.component';

@Component({
  selector: 'app-info-landing-link-host',
  imports: [InfoLandingLinkComponent],
  template: `<app-info-landing-link [anchor]="anchor" [label]="label" />`,
})
class InfoLandingLinkHostComponent {
  anchor = INFO_LANDING_ANCHORS.workflow;
  label = 'Einsatzmöglichkeiten';
}

@Component({
  selector: 'app-info-landing-link-presenter-host',
  imports: [InfoLandingLinkComponent],
  template: `<app-info-landing-link [anchor]="anchor" [label]="label" leadIcon="presenter" />`,
})
class InfoLandingLinkPresenterHostComponent {
  anchor = INFO_LANDING_ANCHORS.hostPairing;
  label = 'Frei im Raum präsentieren';
}

@Component({
  selector: 'app-info-landing-link-text-host',
  imports: [InfoLandingLinkComponent],
  template: `<app-info-landing-link [anchor]="anchor" [label]="label" appearance="text" />`,
})
class InfoLandingLinkTextHostComponent {
  anchor = INFO_LANDING_ANCHORS.workflow;
  label = 'Einsatzmöglichkeiten';
}

@Component({
  selector: 'app-info-landing-link-help-host',
  imports: [InfoLandingLinkComponent],
  template: `<app-info-landing-link [anchor]="anchor" [label]="label" leadIcon="help" />`,
})
class InfoLandingLinkHelpHostComponent {
  anchor = INFO_LANDING_ANCHORS.workflow;
  label = 'Einsatzmöglichkeiten';
}

describe('InfoLandingLinkComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        InfoLandingLinkHostComponent,
        InfoLandingLinkPresenterHostComponent,
        InfoLandingLinkTextHostComponent,
        InfoLandingLinkHelpHostComponent,
      ],
    });
  });

  it('bindet href reaktiv an ThemePresetService.theme und ignoriert das Preset', () => {
    const fixture = TestBed.createComponent(InfoLandingLinkHostComponent);
    const themePreset = TestBed.inject(ThemePresetService);
    themePreset.setTheme('system');
    themePreset.setPreset('spielerisch', { silent: true });
    fixture.detectChanges();

    const link = () =>
      (fixture.nativeElement as HTMLElement).querySelector(
        'a.info-landing-link',
      ) as HTMLAnchorElement | null;

    expect(link()?.getAttribute('href')).toBe('https://info.arsnova.eu/de/?theme=system#workflow');
    expect(link()?.target).toBe('_blank');
    expect(link()?.rel).toBe('noopener noreferrer');

    themePreset.setTheme('dark');
    fixture.detectChanges();
    expect(link()?.getAttribute('href')).toBe('https://info.arsnova.eu/de/?theme=dark#workflow');

    themePreset.setTheme('light');
    fixture.detectChanges();
    expect(link()?.getAttribute('href')).toBe('https://info.arsnova.eu/de/?theme=light#workflow');

    themePreset.setPreset('serious', { silent: true });
    fixture.detectChanges();
    expect(link()?.getAttribute('href')).toBe('https://info.arsnova.eu/de/?theme=light#workflow');
  });

  it('kann als MD3-Textaktion ohne Unterstreichung dargestellt werden', () => {
    const fixture = TestBed.createComponent(InfoLandingLinkTextHostComponent);
    fixture.detectChanges();
    const link = (fixture.nativeElement as HTMLElement).querySelector('a.info-landing-link');
    expect(link?.classList.contains('info-landing-link--text')).toBe(true);
  });

  it('kann das Outlined-Hilfe-Icon statt des Info-Punkts zeigen', () => {
    const fixture = TestBed.createComponent(InfoLandingLinkHelpHostComponent);
    fixture.detectChanges();
    const icon = (fixture.nativeElement as HTMLElement).querySelector(
      'mat-icon.info-landing-link__lead-icon',
    );
    expect(icon?.textContent?.trim()).toBe('help_outline');
  });

  it('zeigt optional die Beamer-Silhouette statt des Info-Icons', () => {
    const fixture = TestBed.createComponent(InfoLandingLinkPresenterHostComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('app-presenter-icon.info-landing-link__lead-icon')).not.toBeNull();
    expect(root.querySelector('mat-icon.info-landing-link__lead-icon')).toBeNull();
  });
});
