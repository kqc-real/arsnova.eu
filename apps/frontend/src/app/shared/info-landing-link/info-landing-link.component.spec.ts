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

describe('InfoLandingLinkComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [InfoLandingLinkHostComponent],
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
});
