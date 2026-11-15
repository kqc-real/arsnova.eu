# A1-Auswertung der vollständigen Versuchsreihe

Baseline: `a19ca70ff37dcb5510a77ab2745c06b70ccc3565`; fünf gepaarte Blöcke, 25 Läufe.

**H1: nicht bestätigt**; 1 von 20 Aktionsvergleichen verfehlen mindestens eine Regel.
**H2: nicht bestätigt**; 6 von 40 Aktionsvergleichen verfehlen mindestens eine Regel.

Alle fünf Wiederholungen müssen die Regeln einhalten. Nicht bestandene Vergleiche werden weder entfernt noch gemittelt.

## Live-Perzentile je Lauf

| Variante | Block | Beitritt p95 ms | Quiz p95 ms | Q&A p95 ms | Tempo p95 ms | Fehler / geplante Aktionen |
| -------- | ----- | --------------- | ----------- | ---------- | ------------ | -------------------------- |
| V0       | 1     | 54.62           | 48.19       | 22.22      | 12.98        | 0 / 1600                   |
| V0       | 2     | 42.48           | 45.27       | 21.10      | 12.41        | 0 / 1600                   |
| V0       | 3     | 56.57           | 52.06       | 20.98      | 12.89        | 0 / 1600                   |
| V0       | 4     | 55.58           | 49.28       | 22.84      | 13.64        | 0 / 1600                   |
| V0       | 5     | 56.82           | 49.30       | 20.25      | 13.85        | 0 / 1600                   |
| V1       | 1     | 58.96           | 47.62       | 17.18      | 14.02        | 0 / 1600                   |
| V1       | 2     | 58.36           | 47.48       | 19.85      | 13.32        | 0 / 1600                   |
| V1       | 3     | 59.15           | 47.09       | 23.22      | 14.43        | 0 / 1600                   |
| V1       | 4     | 61.89           | 47.66       | 18.97      | 13.32        | 0 / 1600                   |
| V1       | 5     | 61.09           | 47.63       | 21.76      | 14.28        | 0 / 1600                   |
| V2       | 1     | 31.25           | 32.31       | 18.58      | 10.97        | 0 / 1600                   |
| V2       | 2     | 57.45           | 45.45       | 18.80      | 13.05        | 0 / 1600                   |
| V2       | 3     | 56.48           | 45.33       | 21.99      | 13.11        | 0 / 1600                   |
| V2       | 4     | 54.04           | 45.65       | 22.95      | 12.69        | 0 / 1600                   |
| V2       | 5     | 57.90           | 48.85       | 20.70      | 14.92        | 0 / 1600                   |
| V3       | 1     | 51.80           | 40.68       | 18.12      | 11.31        | 0 / 1600                   |
| V3       | 2     | 35.04           | 32.21       | 16.79      | 10.19        | 0 / 1600                   |
| V3       | 3     | 23.20           | 18.52       | 16.20      | 9.44         | 0 / 1600                   |
| V3       | 4     | 53.10           | 41.66       | 19.51      | 11.97        | 0 / 1600                   |
| V3       | 5     | 225.62          | 167.37      | 236.21     | 32.95        | 0 / 1600                   |
| V4       | 1     | 58.71           | 47.00       | 15.39      | 13.46        | 0 / 1600                   |
| V4       | 2     | 53.83           | 43.39       | 18.05      | 12.71        | 0 / 1600                   |
| V4       | 3     | 58.84           | 48.43       | 22.52      | 14.70        | 0 / 1600                   |
| V4       | 4     | 57.57           | 48.58       | 20.95      | 13.76        | 0 / 1600                   |
| V4       | 5     | 56.52           | 47.17       | 24.19      | 12.83        | 0 / 1600                   |

## Gepaarte Aktionsvergleiche

| Block | Vergleich | Aktion     | Basis p95 ms | Kandidat p95 ms | Änderung ms | Änderung relativ | ≤ 10 %        | ≤ 50 ms       | Gesamt        |
| ----- | --------- | ---------- | ------------ | --------------- | ----------- | ---------------- | ------------- | ------------- | ------------- |
| 1     | V0 → V1   | join       | 54.62        | 58.96           | 4.33        | 7.93 %           | erfüllt       | erfüllt       | erfüllt       |
| 1     | V0 → V1   | vote       | 48.19        | 47.62           | -0.57       | -1.18 %          | erfüllt       | erfüllt       | erfüllt       |
| 1     | V0 → V1   | qaSubmit   | 22.22        | 17.18           | -5.04       | -22.69 %         | erfüllt       | erfüllt       | erfüllt       |
| 1     | V0 → V1   | blitzlicht | 12.98        | 14.02           | 1.04        | 7.98 %           | erfüllt       | erfüllt       | erfüllt       |
| 1     | V1 → V2   | join       | 58.96        | 31.25           | -27.71      | -47.00 %         | erfüllt       | erfüllt       | erfüllt       |
| 1     | V1 → V2   | vote       | 47.62        | 32.31           | -15.31      | -32.14 %         | erfüllt       | erfüllt       | erfüllt       |
| 1     | V1 → V2   | qaSubmit   | 17.18        | 18.58           | 1.40        | 8.13 %           | erfüllt       | erfüllt       | erfüllt       |
| 1     | V1 → V2   | blitzlicht | 14.02        | 10.97           | -3.04       | -21.71 %         | erfüllt       | erfüllt       | erfüllt       |
| 1     | V1 → V3   | join       | 58.96        | 51.80           | -7.15       | -12.13 %         | erfüllt       | erfüllt       | erfüllt       |
| 1     | V1 → V3   | vote       | 47.62        | 40.68           | -6.94       | -14.57 %         | erfüllt       | erfüllt       | erfüllt       |
| 1     | V1 → V3   | qaSubmit   | 17.18        | 18.12           | 0.93        | 5.44 %           | erfüllt       | erfüllt       | erfüllt       |
| 1     | V1 → V3   | blitzlicht | 14.02        | 11.31           | -2.71       | -19.34 %         | erfüllt       | erfüllt       | erfüllt       |
| 1     | V1 → V4   | join       | 58.96        | 58.71           | -0.25       | -0.42 %          | erfüllt       | erfüllt       | erfüllt       |
| 1     | V1 → V4   | vote       | 47.62        | 47.00           | -0.62       | -1.29 %          | erfüllt       | erfüllt       | erfüllt       |
| 1     | V1 → V4   | qaSubmit   | 17.18        | 15.39           | -1.79       | -10.41 %         | erfüllt       | erfüllt       | erfüllt       |
| 1     | V1 → V4   | blitzlicht | 14.02        | 13.46           | -0.55       | -3.96 %          | erfüllt       | erfüllt       | erfüllt       |
| 2     | V0 → V1   | join       | 42.48        | 58.36           | 15.88       | 37.38 %          | nicht erfüllt | erfüllt       | nicht erfüllt |
| 2     | V0 → V1   | vote       | 45.27        | 47.48           | 2.21        | 4.88 %           | erfüllt       | erfüllt       | erfüllt       |
| 2     | V0 → V1   | qaSubmit   | 21.10        | 19.85           | -1.25       | -5.92 %          | erfüllt       | erfüllt       | erfüllt       |
| 2     | V0 → V1   | blitzlicht | 12.41        | 13.32           | 0.91        | 7.35 %           | erfüllt       | erfüllt       | erfüllt       |
| 2     | V1 → V2   | join       | 58.36        | 57.45           | -0.91       | -1.55 %          | erfüllt       | erfüllt       | erfüllt       |
| 2     | V1 → V2   | vote       | 47.48        | 45.45           | -2.03       | -4.29 %          | erfüllt       | erfüllt       | erfüllt       |
| 2     | V1 → V2   | qaSubmit   | 19.85        | 18.80           | -1.05       | -5.27 %          | erfüllt       | erfüllt       | erfüllt       |
| 2     | V1 → V2   | blitzlicht | 13.32        | 13.05           | -0.27       | -2.03 %          | erfüllt       | erfüllt       | erfüllt       |
| 2     | V1 → V3   | join       | 58.36        | 35.04           | -23.32      | -39.96 %         | erfüllt       | erfüllt       | erfüllt       |
| 2     | V1 → V3   | vote       | 47.48        | 32.21           | -15.28      | -32.17 %         | erfüllt       | erfüllt       | erfüllt       |
| 2     | V1 → V3   | qaSubmit   | 19.85        | 16.79           | -3.05       | -15.39 %         | erfüllt       | erfüllt       | erfüllt       |
| 2     | V1 → V3   | blitzlicht | 13.32        | 10.19           | -3.13       | -23.49 %         | erfüllt       | erfüllt       | erfüllt       |
| 2     | V1 → V4   | join       | 58.36        | 53.83           | -4.53       | -7.76 %          | erfüllt       | erfüllt       | erfüllt       |
| 2     | V1 → V4   | vote       | 47.48        | 43.39           | -4.10       | -8.63 %          | erfüllt       | erfüllt       | erfüllt       |
| 2     | V1 → V4   | qaSubmit   | 19.85        | 18.05           | -1.80       | -9.05 %          | erfüllt       | erfüllt       | erfüllt       |
| 2     | V1 → V4   | blitzlicht | 13.32        | 12.71           | -0.61       | -4.58 %          | erfüllt       | erfüllt       | erfüllt       |
| 3     | V0 → V1   | join       | 56.57        | 59.15           | 2.58        | 4.55 %           | erfüllt       | erfüllt       | erfüllt       |
| 3     | V0 → V1   | vote       | 52.06        | 47.09           | -4.97       | -9.54 %          | erfüllt       | erfüllt       | erfüllt       |
| 3     | V0 → V1   | qaSubmit   | 20.98        | 23.22           | 2.24        | 10.69 %          | nicht erfüllt | erfüllt       | nicht erfüllt |
| 3     | V0 → V1   | blitzlicht | 12.89        | 14.43           | 1.54        | 11.97 %          | nicht erfüllt | erfüllt       | nicht erfüllt |
| 3     | V1 → V2   | join       | 59.15        | 56.48           | -2.67       | -4.52 %          | erfüllt       | erfüllt       | erfüllt       |
| 3     | V1 → V2   | vote       | 47.09        | 45.33           | -1.76       | -3.74 %          | erfüllt       | erfüllt       | erfüllt       |
| 3     | V1 → V2   | qaSubmit   | 23.22        | 21.99           | -1.23       | -5.29 %          | erfüllt       | erfüllt       | erfüllt       |
| 3     | V1 → V2   | blitzlicht | 14.43        | 13.11           | -1.32       | -9.16 %          | erfüllt       | erfüllt       | erfüllt       |
| 3     | V1 → V3   | join       | 59.15        | 23.20           | -35.95      | -60.78 %         | erfüllt       | erfüllt       | erfüllt       |
| 3     | V1 → V3   | vote       | 47.09        | 18.52           | -28.57      | -60.68 %         | erfüllt       | erfüllt       | erfüllt       |
| 3     | V1 → V3   | qaSubmit   | 23.22        | 16.20           | -7.02       | -30.24 %         | erfüllt       | erfüllt       | erfüllt       |
| 3     | V1 → V3   | blitzlicht | 14.43        | 9.44            | -4.99       | -34.59 %         | erfüllt       | erfüllt       | erfüllt       |
| 3     | V1 → V4   | join       | 59.15        | 58.84           | -0.31       | -0.53 %          | erfüllt       | erfüllt       | erfüllt       |
| 3     | V1 → V4   | vote       | 47.09        | 48.43           | 1.34        | 2.84 %           | erfüllt       | erfüllt       | erfüllt       |
| 3     | V1 → V4   | qaSubmit   | 23.22        | 22.52           | -0.71       | -3.05 %          | erfüllt       | erfüllt       | erfüllt       |
| 3     | V1 → V4   | blitzlicht | 14.43        | 14.70           | 0.27        | 1.85 %           | erfüllt       | erfüllt       | erfüllt       |
| 4     | V0 → V1   | join       | 55.58        | 61.89           | 6.31        | 11.35 %          | nicht erfüllt | erfüllt       | nicht erfüllt |
| 4     | V0 → V1   | vote       | 49.28        | 47.66           | -1.62       | -3.29 %          | erfüllt       | erfüllt       | erfüllt       |
| 4     | V0 → V1   | qaSubmit   | 22.84        | 18.97           | -3.87       | -16.94 %         | erfüllt       | erfüllt       | erfüllt       |
| 4     | V0 → V1   | blitzlicht | 13.64        | 13.32           | -0.33       | -2.39 %          | erfüllt       | erfüllt       | erfüllt       |
| 4     | V1 → V2   | join       | 61.89        | 54.04           | -7.84       | -12.68 %         | erfüllt       | erfüllt       | erfüllt       |
| 4     | V1 → V2   | vote       | 47.66        | 45.65           | -2.01       | -4.22 %          | erfüllt       | erfüllt       | erfüllt       |
| 4     | V1 → V2   | qaSubmit   | 18.97        | 22.95           | 3.98        | 20.96 %          | nicht erfüllt | erfüllt       | nicht erfüllt |
| 4     | V1 → V2   | blitzlicht | 13.32        | 12.69           | -0.63       | -4.71 %          | erfüllt       | erfüllt       | erfüllt       |
| 4     | V1 → V3   | join       | 61.89        | 53.10           | -8.78       | -14.19 %         | erfüllt       | erfüllt       | erfüllt       |
| 4     | V1 → V3   | vote       | 47.66        | 41.66           | -5.99       | -12.58 %         | erfüllt       | erfüllt       | erfüllt       |
| 4     | V1 → V3   | qaSubmit   | 18.97        | 19.51           | 0.53        | 2.82 %           | erfüllt       | erfüllt       | erfüllt       |
| 4     | V1 → V3   | blitzlicht | 13.32        | 11.97           | -1.35       | -10.14 %         | erfüllt       | erfüllt       | erfüllt       |
| 4     | V1 → V4   | join       | 61.89        | 57.57           | -4.32       | -6.98 %          | erfüllt       | erfüllt       | erfüllt       |
| 4     | V1 → V4   | vote       | 47.66        | 48.58           | 0.93        | 1.94 %           | erfüllt       | erfüllt       | erfüllt       |
| 4     | V1 → V4   | qaSubmit   | 18.97        | 20.95           | 1.97        | 10.41 %          | nicht erfüllt | erfüllt       | nicht erfüllt |
| 4     | V1 → V4   | blitzlicht | 13.32        | 13.76           | 0.44        | 3.33 %           | erfüllt       | erfüllt       | erfüllt       |
| 5     | V0 → V1   | join       | 56.82        | 61.09           | 4.27        | 7.52 %           | erfüllt       | erfüllt       | erfüllt       |
| 5     | V0 → V1   | vote       | 49.30        | 47.63           | -1.67       | -3.39 %          | erfüllt       | erfüllt       | erfüllt       |
| 5     | V0 → V1   | qaSubmit   | 20.25        | 21.76           | 1.51        | 7.43 %           | erfüllt       | erfüllt       | erfüllt       |
| 5     | V0 → V1   | blitzlicht | 13.85        | 14.28           | 0.43        | 3.11 %           | erfüllt       | erfüllt       | erfüllt       |
| 5     | V1 → V2   | join       | 61.09        | 57.90           | -3.19       | -5.22 %          | erfüllt       | erfüllt       | erfüllt       |
| 5     | V1 → V2   | vote       | 47.63        | 48.85           | 1.22        | 2.56 %           | erfüllt       | erfüllt       | erfüllt       |
| 5     | V1 → V2   | qaSubmit   | 21.76        | 20.70           | -1.06       | -4.85 %          | erfüllt       | erfüllt       | erfüllt       |
| 5     | V1 → V2   | blitzlicht | 14.28        | 14.92           | 0.64        | 4.51 %           | erfüllt       | erfüllt       | erfüllt       |
| 5     | V1 → V3   | join       | 61.09        | 225.62          | 164.54      | 269.35 %         | nicht erfüllt | nicht erfüllt | nicht erfüllt |
| 5     | V1 → V3   | vote       | 47.63        | 167.37          | 119.75      | 251.44 %         | nicht erfüllt | nicht erfüllt | nicht erfüllt |
| 5     | V1 → V3   | qaSubmit   | 21.76        | 236.21          | 214.45      | 985.62 %         | nicht erfüllt | nicht erfüllt | nicht erfüllt |
| 5     | V1 → V3   | blitzlicht | 14.28        | 32.95           | 18.67       | 130.78 %         | nicht erfüllt | erfüllt       | nicht erfüllt |
| 5     | V1 → V4   | join       | 61.09        | 56.52           | -4.57       | -7.48 %          | erfüllt       | erfüllt       | erfüllt       |
| 5     | V1 → V4   | vote       | 47.63        | 47.17           | -0.45       | -0.95 %          | erfüllt       | erfüllt       | erfüllt       |
| 5     | V1 → V4   | qaSubmit   | 21.76        | 24.19           | 2.43        | 11.17 %          | nicht erfüllt | erfüllt       | nicht erfüllt |
| 5     | V1 → V4   | blitzlicht | 14.28        | 12.83           | -1.45       | -10.17 %         | erfüllt       | erfüllt       | erfüllt       |

## Analyseverfügbarkeit

| Variante | Block | Geplant | Erfolg | Fallback | Ohne Abschluss im Fenster | Unverfügbar | Erfolg p95 ms   | Fallback p95 ms |
| -------- | ----- | ------- | ------ | -------- | ------------------------- | ----------- | --------------- | --------------- |
| V1       | 1     | 150     | 0      | 150      | 0                         | 100.00 %    | nicht verfügbar | 40.81           |
| V1       | 2     | 150     | 0      | 150      | 0                         | 100.00 %    | nicht verfügbar | 37.27           |
| V1       | 3     | 150     | 0      | 150      | 0                         | 100.00 %    | nicht verfügbar | 43.45           |
| V1       | 4     | 150     | 0      | 150      | 0                         | 100.00 %    | nicht verfügbar | 41.38           |
| V1       | 5     | 150     | 0      | 150      | 0                         | 100.00 %    | nicht verfügbar | 39.92           |
| V2       | 1     | 150     | 150    | 0        | 0                         | 0.00 %      | 498.38          | nicht verfügbar |
| V2       | 2     | 150     | 150    | 0        | 0                         | 0.00 %      | 479.91          | nicht verfügbar |
| V2       | 3     | 150     | 150    | 0        | 0                         | 0.00 %      | 463.91          | nicht verfügbar |
| V2       | 4     | 150     | 150    | 0        | 0                         | 0.00 %      | 473.46          | nicht verfügbar |
| V2       | 5     | 150     | 150    | 0        | 0                         | 0.00 %      | 477.75          | nicht verfügbar |
| V3       | 1     | 150     | 150    | 0        | 0                         | 0.00 %      | 2868.92         | nicht verfügbar |
| V3       | 2     | 150     | 149    | 0        | 1                         | 0.67 %      | 2560.54         | nicht verfügbar |
| V3       | 3     | 150     | 149    | 0        | 1                         | 0.67 %      | 2202.60         | nicht verfügbar |
| V3       | 4     | 150     | 149    | 0        | 1                         | 0.67 %      | 3178.87         | nicht verfügbar |
| V3       | 5     | 150     | 144    | 6        | 0                         | 4.00 %      | 2667.70         | 5182.38         |
| V4       | 1     | 150     | 0      | 149      | 1                         | 100.00 %    | nicht verfügbar | 5047.32         |
| V4       | 2     | 150     | 0      | 149      | 1                         | 100.00 %    | nicht verfügbar | 5044.01         |
| V4       | 3     | 150     | 0      | 149      | 1                         | 100.00 %    | nicht verfügbar | 5051.86         |
| V4       | 4     | 150     | 0      | 149      | 1                         | 100.00 %    | nicht verfügbar | 5063.11         |
| V4       | 5     | 150     | 0      | 149      | 1                         | 100.00 %    | nicht verfügbar | 5061.27         |

## spaCy-Ressourcen im Messfenster

| Variante | Block | CPU % einer CPU | Gedrosselte Perioden | Anteil  | Abgetastetes RAM-Maximum MiB | Lebenszeit-Peak MiB | OOM-Zuwachs |
| -------- | ----- | --------------- | -------------------- | ------- | ---------------------------- | ------------------- | ----------- |
| V2       | 1     | 18.63           | 8 / 950              | 0.84 %  | 477.69                       | 480.01              | 0           |
| V2       | 2     | 18.49           | 7 / 993              | 0.70 %  | 470.99                       | 480.17              | 0           |
| V2       | 3     | 18.29           | 6 / 928              | 0.65 %  | 475.39                       | 479.61              | 0           |
| V2       | 4     | 18.36           | 5 / 947              | 0.53 %  | 467.43                       | 480.53              | 0           |
| V2       | 5     | 18.44           | 7 / 985              | 0.71 %  | 466.90                       | 479.53              | 0           |
| V3       | 1     | 22.78           | 2638 / 2861          | 92.21 % | 491.60                       | 492.18              | 0           |
| V3       | 2     | 21.85           | 2553 / 2802          | 91.11 % | 482.57                       | 491.70              | 0           |
| V3       | 3     | 20.03           | 2310 / 2611          | 88.47 % | 489.41                       | 490.04              | 0           |
| V3       | 4     | 24.01           | 2839 / 2961          | 95.88 % | 491.25                       | 492.32              | 0           |
| V3       | 5     | 21.88           | 2506 / 2790          | 89.82 % | 502.09                       | 505.11              | 0           |
| V4       | 1     | 0.55            | 0 / 146              | 0.00 %  | 459.57                       | 463.44              | 0           |
| V4       | 2     | 0.53            | 0 / 123              | 0.00 %  | 457.97                       | 463.21              | 0           |
| V4       | 3     | 0.53            | 0 / 149              | 0.00 %  | 461.33                       | 463.81              | 0           |
| V4       | 4     | 0.53            | 0 / 161              | 0.00 %  | 458.68                       | 463.94              | 0           |
| V4       | 5     | 0.53            | 0 / 155              | 0.00 %  | 458.86                       | 464.27              | 0           |

## Regeln für den Normalbetrieb

- `analysisAvailabilityPassed`: erfüllt.
- `throttlingPassed`: erfüllt.
- `memoryPassed`: erfüllt.
- `oomPassed`: erfüllt.
- `voteTargetPassed`: erfüllt.

**Aktivierung durch alle vorab festgelegten Regeln gedeckt: nein.**

Die inhaltliche Betriebsentscheidung und Grenzen stehen in der begleitenden Auswertungsdokumentation.

## Berechnung und Grenzen

Perzentile werden aus erfolgreichen Rohstichproben je Lauf neu berechnet (Nearest Rank). Relative und absolute Grenze gelten gleichzeitig und einschließlich Gleichheit; geprüft wird vor der Anzeige-Rundung. Die Abdeckung verwendet alle geplanten Aktionen.

CPU- und Drosselungswerte sind Zählerdifferenzen derselben Generation im Messfenster. Der RAM-Lebenszeit-Peak umfasst auch die Aufwärmung; er wird nicht von einem früheren Peak subtrahiert. Sämtliche Containerressourcen stehen zusätzlich in auswertung.json.

IN_FLIGHT_AT_END bleibt trotz späterem cleanup-Erfolg unverfügbar. V4-Proxyzähler umfassen die Proxy-Lebenszeit einschließlich Aufwärmung; Backend-Aufrufzähler sind kein Nachweis tatsächlich an spaCy weitergeleiteter Berechnungen.

Lastgenerator und Dienste teilen denselben WSL2-Rechner mit 16 logischen CPUs. Die Beitrittswelle belegt keine dauerhafte Parallelität, keine Browser-Renderingzeit und keine Tragfähigkeit zusätzlicher LLM-Inferenz.
