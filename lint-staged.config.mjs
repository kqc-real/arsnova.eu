export const RELATED_TESTS_COMMAND = 'npm run test:related -- --no-isolate';

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

function isEslintCodeFile(file) {
  return /\.(?:ts|js)$/.test(file);
}

function isEslintHtmlFile(file) {
  return /(?:^|\/)apps\/frontend\/src\/.*\.html$/.test(file.replaceAll('\\', '/'));
}

function isPrettierFile(file) {
  return /\.(?:ts|js|mjs|cjs|json|html|css|scss|md)$/.test(file);
}

export function buildLintStagedCommands(files) {
  const commands = [];
  const eslintFiles = files.filter((file) => isEslintCodeFile(file) || isEslintHtmlFile(file));
  const prettierFiles = files.filter(isPrettierFile);

  if (eslintFiles.length > 0) {
    commands.push(`eslint --no-warn-ignored --fix -- ${eslintFiles.map(shellQuote).join(' ')}`);
  }
  if (prettierFiles.length > 0) {
    commands.push(`prettier --write -- ${prettierFiles.map(shellQuote).join(' ')}`);
  }
  commands.push(RELATED_TESTS_COMMAND);
  return commands;
}

export default {
  '*': (files) => buildLintStagedCommands(files),
};
