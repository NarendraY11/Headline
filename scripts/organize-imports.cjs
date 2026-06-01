// One-shot: strip unused imports across files flagged by tsc (TS6133/TS6192).
// Uses the TypeScript language service's organizeImports (same as VS Code "Organize Imports").
// Run: node scripts/organize-imports.cjs <file1> <file2> ...
const ts = require("typescript");
const fs = require("fs");
const path = require("path");

const files = process.argv.slice(2).map((f) => path.resolve(process.cwd(), f));
if (files.length === 0) {
  console.error("No files passed.");
  process.exit(1);
}

const configPath = path.resolve(process.cwd(), "tsconfig.json");
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  process.cwd()
);

// Track current text per file in memory so the service sees latest.
const fileVersions = new Map();
const fileTexts = new Map();
for (const f of files) {
  fileTexts.set(f, fs.readFileSync(f, "utf8"));
  fileVersions.set(f, 0);
}

const allRootFiles = Array.from(new Set([...parsed.fileNames, ...files]));

const host = {
  getScriptFileNames: () => allRootFiles,
  getScriptVersion: (f) => String(fileVersions.get(path.resolve(f)) || 0),
  getScriptSnapshot: (f) => {
    const abs = path.resolve(f);
    const text = fileTexts.has(abs)
      ? fileTexts.get(abs)
      : ts.sys.readFile(f);
    if (text === undefined) return undefined;
    return ts.ScriptSnapshot.fromString(text);
  },
  getCurrentDirectory: () => process.cwd(),
  getCompilationSettings: () => parsed.options,
  getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  readDirectory: ts.sys.readDirectory,
  directoryExists: ts.sys.directoryExists,
  getDirectories: ts.sys.getDirectories,
};

const service = ts.createLanguageService(host, ts.createDocumentRegistry());

const formatOptions = ts.getDefaultFormatCodeSettings("\n");
const preferences = {};

for (const f of files) {
  const changes = service.organizeImports(
    { type: "file", fileName: f },
    formatOptions,
    preferences
  );
  for (const change of changes) {
    if (path.resolve(change.fileName) !== f) continue;
    let text = fileTexts.get(f);
    // Apply edits from end to start to keep offsets valid.
    const edits = [...change.textChanges].sort(
      (a, b) => b.span.start - a.span.start
    );
    for (const e of edits) {
      text =
        text.slice(0, e.span.start) +
        e.newText +
        text.slice(e.span.start + e.span.length);
    }
    fileTexts.set(f, text);
    fileVersions.set(f, fileVersions.get(f) + 1);
    fs.writeFileSync(f, text, "utf8");
    console.log("organized:", path.relative(process.cwd(), f));
  }
}
