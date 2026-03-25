#!/usr/bin/env node
/**
 * Liest messages.xlf und fügt alle fehlenden trans-units mit englischem <target> zu messages.en.xlf hinzu.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localeDir = path.join(__dirname, '../src/locale');
const xlfPath = path.join(localeDir, 'messages.xlf');
const enPath = path.join(localeDir, 'messages.en.xlf');

const TARGET_MAP = {
  'quiz.presetApply': 'Apply <x id="INTERPOLATION" equiv-text="{{ preset.label }}"/>',
  '1013568912261252993': 'Paste AI JSON',
  '1110390562708491750': 'Number of teams',
  '1129308278678680080': 'Assign teams',
  '1182293107570344716': 'Question type',
  '1229476588328636113': 'Label maximum (optional)',
  '1245945853792844677': 'Enter question text.',
  '1573644813194149153': 'Adjust settings',
  '1577042233775426233': 'Question text',
  '1736772795054152455': 'Hide settings',
  '1742287928029463475': 'Settings applied.',
  '1843830756194261727': 'Sync',
  '187187500641108332': '<x id="INTERPOLATION" equiv-text="{{ questions().length }}"/>',
  '1892540928773826144': 'Delete (live)',
  '2261296473393717678': 'Play in teams',
  '2355797381776819101': ' Show encouragement ',
  '2400955821540044178': 'At most 50 bonus codes.',
  '2431517154855981271': 'At most 300 seconds.',
  '2525684207823121577': ' Participants answer freely here – no predefined answers needed. ',
  '2616703419117401747': 'At least 5 seconds.',
  '2628864790352729354': 'Description (optional)',
  '2650319028885568688': 'At most 500 characters.',
  '2685316649628563933': '<x id="INTERPOLATION" equiv-text="{{ questions().length }}"/> questions',
  '2692783602359224969': 'Choose file',
  '2782132960865520584': 'Play sounds',
  '2791556515624323205': 'At least 2 teams.',
  '281161753824332366': 'Open preview',
  '2856257833786492684': 'Answer <x id="INTERPOLATION" equiv-text="{{ i + 1 }}"/>',
  '2863483573986908286': 'Question',
  '2963862029448330443': 'Question text may be at most 2000 characters.',
  '3127243514376945641': ' Copy the prompt into your AI, then paste the generated JSON here. ',
  '3218489830147697230': '1 question',
  '3241474076591504793': 'Saved.',
  '3299340173858348406': 'Bonus codes for top places (optional)',
  '341765638334099836': 'Edit question',
  '3469430709894599256': ' Paste the JSON from your AI or load it as a file. We check the content before importing. ',
  '3509273486839658148': 'Leave empty to award no bonus codes.',
  '3515317012613638265': 'Difficulty',
  '3567296382906760482': ' Create your first quiz or import one via JSON. ',
  '3643065623582513222': 'Answers',
  '3700479510053399162': 'Question list',
  '3730214089391253539': 'Live preview',
  '382752805490514678': ' Allow custom nicknames ',
  '3827964072457808965': 'No questions yet',
  '3856389466227560114': ' Start import ',
  '4150250960798262494': ' Add your first question above to get started. ',
  '4435703504669117699': 'Settings',
  '4579210211803634368': ' Markdown and KaTeX are rendered in the preview below. ',
  '4580399730639224598': 'Delete',
  '4611696472883105418': ' You are editing an existing question. Click "Update" to save changes. ',
  '4861370785316880928': 'Participate anonymously',
  '4928437576183373640': 'Title &amp; description',
  '5088922883755257679': 'Copy prompt',
  '5590446157839389105': 'Go live',
  '5642511860113360206': 'Show leaderboard',
  '5647672382112608804': 'Age group for names',
  '5893501665486949127': 'New quiz',
  '5939653501562597742': 'Name may be at most 200 characters.',
  '5988877745866171840': ' Import ',
  '6218443954027762472': 'Manual',
  '623302995999546215': 'Add',
  '6278157135662238363': 'Enter answer text.',
  '6471364499877510205': 'Duplicate',
  '6568899376509991089': 'Apply to all questions in this quiz',
  '6655547102817503628': 'Create first quiz',
  '6672916435220201136': 'To list',
  '6809333927973571945': ' Your quiz library is empty. ',
  '6862352681342046423': ' Reading phase before answering ',
  '6991540885968863848': ' Show rewards ',
  '7287117104463920417': 'Overwrites existing answers.',
  '7479683756900419424': 'Creating…',
  '7492260970005034710': ' Formula error: <x id="INTERPOLATION" equiv-text="{{ previewKatexError() }}"/> ',
  '7503778474761741054': 'Automatic',
  '7544463867005932926': 'Label minimum (optional)',
  '7547865767239725827': 'Create quiz',
  '7620597678842046410': 'Quiz not found.',
  '7640339655716023309': 'Leave empty for no time limit.',
  '7678024627255247069': 'Apply',
  '7832220288598509801': 'Update',
  '8021687558521014030': 'Option',
  '8045223473941356687': 'At most 8 teams.',
  '8104152103272919854': 'Preview',
  '8122550761270535954': 'Added',
  '8205020163645016790': 'Quick format',
  '8259238864102475814': 'Scale',
  '8266267788371304686': 'Another answer',
  '8606357587641495734': 'Background music',
  'quizEdit.descriptionMaxLengthError': 'Description may be at most 5000 characters.',
  '8651032424782410006': 'AI JSON',
  '867046407244543093': ' Choose a question type and add answers. You can use Markdown and KaTeX. ',
  '8768083855656807358': 'Give your quiz a name.',
  '8823381792360645071': 'Time limit per question in seconds (optional)',
  '884716686888359227': 'New question',
  '88521927529972246': ' Allow emojis ',
  '8953033926734869941': 'Name',
  '9015237973110909131': 'Questions in quiz',
  '9039835516404568569': 'Copy AI prompt',
  '9198827608414028616': 'At least 1 bonus code.',
};

const xlf = fs.readFileSync(xlfPath, 'utf8');
const en = fs.readFileSync(enPath, 'utf8');

const existingIds = new Set();
const idRegex = /<trans-unit id="([^"]+)"[^>]*>[\s\S]*?<target>/g;
let match;
while ((match = idRegex.exec(en)) !== null) existingIds.add(match[1]);

const unitRegex = /<trans-unit id="([^"]+)"[^>]*>([\s\S]*?)<\/trans-unit>/g;
const unitsToInsert = [];
while ((match = unitRegex.exec(xlf)) !== null) {
  const id = match[1];
  if (!existingIds.has(id) && TARGET_MAP[id]) {
    const inner = match[2];
    const srcMatch = inner.match(/<source>([\s\S]*?)<\/source>/);
    if (!srcMatch) continue;
    const targetText = TARGET_MAP[id];
    const targetEscaped = targetText.replace(/&/g, '&amp;');
    unitsToInsert.push(`      <trans-unit id="${id}" datatype="html">
        <source>${srcMatch[1]}
        </source>
        <target>${targetEscaped}
        </target>
      </trans-unit>`);
  }
}

if (unitsToInsert.length === 0) {
  console.log('No missing translations to add.');
  process.exit(0);
}

const insertPoint = en.lastIndexOf('    </body>');
const before = en.slice(0, insertPoint);
const after = en.slice(insertPoint);
const out = before + '\n' + unitsToInsert.join('\n') + '\n' + after;
fs.writeFileSync(enPath, out, 'utf8');
console.log(`Added ${unitsToInsert.length} missing translation(s) to messages.en.xlf`);
