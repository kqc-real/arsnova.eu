/**
 * Lädt `.env` aus Repo-Root oder aktuellem Arbeitsverzeichnis, damit `ADMIN_SECRET`
 * u. a. gesetzt sind (npm run dev vom Monorepo-Root oder aus apps/backend).
 */
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

const candidates = [path.join(process.cwd(), '.env'), path.join(process.cwd(), '..', '..', '.env')];

for (const file of candidates) {
  if (fs.existsSync(file)) {
    config({ path: file });
    break;
  }
}
