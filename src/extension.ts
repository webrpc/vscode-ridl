import {
  type Disposable,
  type OutputChannel,
  TextEdit,
  languages,
  workspace,
  Range,
  window,
  type ExtensionContext,
} from "vscode";
import { execFile } from "child_process";
import { join } from "path";
import { existsSync } from "fs";

const BINARY_NAME = "ridlfmt";
const BUILD_DIR = "bin";

export function activate(_context: ExtensionContext) {
  const outputChannel = window.createOutputChannel("RIDL Formatter");
  let disposable: Disposable | null = null;

  workspace.onDidChangeConfiguration((event) => {
    if (!event.affectsConfiguration("ridl")) return;
    disposable?.dispose();
    disposable = registerRidlFormatter(outputChannel);
  });

  disposable = registerRidlFormatter(outputChannel);
}

function registerRidlFormatter(outputChannel: OutputChannel): Disposable {
  return languages.registerDocumentFormattingEditProvider("ridl", {
    provideDocumentFormattingEdits(document) {
      const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
      const backupFolder = workspace.workspaceFolders?.[0];
      const workspaceCwd =
        workspaceFolder?.uri?.fsPath || backupFolder?.uri.fsPath;

      return new Promise<TextEdit[]>(async (resolve, reject) => {
        const binaryPath = getBinaryPath();

        // Check if the binary exists
        if (!existsSync(binaryPath)) {
          outputChannel.appendLine(
            `Binary not found: ${binaryPath}. Did you build the formatter?`
          );
          return;
        }

        outputChannel.appendLine(`Starting ridl formatter: ${binaryPath}`);

        const originalDocumentText = document.getText();

        const process = execFile(
          binaryPath,
          ["-s", document.fileName],
          { cwd: workspaceCwd },
          (error, stdout, stderr) => {
            if (error) {
              outputChannel.appendLine(
                `Formatter failed: ${binaryPath}\nStderr:\n${stderr}`
              );
              reject(error);
            }

            if (originalDocumentText.length > 0 && stdout.length === 0) {
              outputChannel.appendLine(
                `Formatter returned nothing - not applying changes.`
              );
              resolve([]);
            }

            const rangeStart = document.lineAt(0).range.start;
            const rangeEnd = document.lineAt(document.lineCount - 1)
              .rangeIncludingLineBreak.end;
            const documentRange = new Range(rangeStart, rangeEnd);

            outputChannel.appendLine(
              `Finished running formatter: ${binaryPath}`
            );
            if (stderr.length > 0) {
              outputChannel.appendLine(`Possible issues ocurred:\n${stderr}`);
            }

            resolve([new TextEdit(documentRange, stdout)]);
          }
        );

        process.stdin?.write(originalDocumentText);
        process.stdin?.end();
      });
    },
  });
}

function getBinaryPath(): string {
  const platform = process.platform;
  const arch = process.arch;

  const binaryName = `${BINARY_NAME}-${platform}-${arch}`;

  return join(__dirname, "..", BUILD_DIR, binaryName);
}
