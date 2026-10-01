import { readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { builtinModules } from 'node:module';

import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const builtins = new Set(builtinModules.map((name) => name.replace(/^node:/, '')));

const allowed: Record<string, readonly string[]> = {
  'apps/web': ['@kinetra/contracts', '@kinetra/domain'],
  'apps/api': ['@kinetra/contracts', '@kinetra/domain', '@kinetra/db'],
  'packages/contracts': [],
  'packages/domain': ['@kinetra/contracts'],
  'packages/db': [],
};
function owner(path: string) {
  return Object.keys(allowed).find((root) => path.startsWith(`${root}/`));
}
export function checkSource(file: string, source: string): string[] {
  const root = owner(file);
  if (!root) return [];
  const errors: string[] = [];
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  function check(specifier: string, typeOnly: boolean) {
    // The web imports only the erased router type, never server runtime code.
    if (root === 'apps/web' && specifier === '@kinetra/api/router' && typeOnly) return;
    if (specifier.startsWith('@kinetra/') && !allowed[root ?? '']?.includes(specifier)) {
      errors.push(`${file}: forbidden workspace import ${specifier}`);
    }
    if (specifier.startsWith('.')) {
      const target = relative(process.cwd(), resolve(dirname(file), specifier));
      if (!target.startsWith(`${root}/`))
        errors.push(`${file}: cross-package relative import ${specifier}`);
    }
    if (
      (root === 'apps/web' || root === 'packages/contracts' || root === 'packages/domain') &&
      (specifier.startsWith('node:') || builtins.has(specifier))
    ) {
      errors.push(`${file}: server builtin ${specifier}`);
    }
    if (
      (root === 'packages/contracts' || root === 'packages/domain') &&
      !specifier.startsWith('.') &&
      !specifier.startsWith('@kinetra/') &&
      specifier !== 'zod'
    ) {
      errors.push(`${file}: infrastructure dependency ${specifier}`);
    }
  }
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const onlyTypes =
        clause?.isTypeOnly ||
        (!clause?.name &&
          bindings &&
          ts.isNamedImports(bindings) &&
          bindings.elements.length > 0 &&
          bindings.elements.every((item) => item.isTypeOnly));
      check(node.moduleSpecifier.text, Boolean(onlyTypes));
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      check(node.moduleSpecifier.text, node.isTypeOnly);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        node.expression.getText(tree) === 'require')
    ) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteral(argument)) check(argument.text, false);
      else errors.push(`${file}: nonliteral module load cannot be checked`);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      check(node.argument.literal.text, true);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return errors;
}
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? files(path) : /\.tsx?$/.test(path) ? [path] : [];
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = Object.keys(allowed).flatMap((root) =>
    files(`${root}/src`).flatMap((file) => checkSource(file, readFileSync(file, 'utf8'))),
  );
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else console.log('Workspace import boundaries passed.');
}
