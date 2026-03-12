/// <reference types="@angular/localize" />

import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import localeEn from '@angular/common/locales/en';
import localeEs from '@angular/common/locales/es';
import localeFr from '@angular/common/locales/fr';
import localeIt from '@angular/common/locales/it';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

registerLocaleData(localeDe);
registerLocaleData(localeEn);
registerLocaleData(localeFr);
registerLocaleData(localeEs);
registerLocaleData(localeIt);

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
