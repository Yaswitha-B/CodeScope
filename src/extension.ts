import * as vscode from 'vscode';
import { DependencyViewProvider } from './ui/dependencyView';
import { buildDependencyGraph } from './analysis/dependencyGraph';

export function activate(context: vscode.ExtensionContext) {
    const dependencyViewProvider = new DependencyViewProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(DependencyViewProvider.viewType, dependencyViewProvider)
    );

    const inspectCommand = vscode.commands.registerCommand('codescope.inspect', async () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showInformationMessage('Open a file to inspect its dependencies.');
            return;
        }

        const fileUri = activeEditor.document.uri;
        if (activeEditor.document.languageId !== 'typescript' && activeEditor.document.languageId !== 'javascript') {
            vscode.window.showInformationMessage('CodeScope only supports JavaScript and TypeScript files.');
            return;
        }

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Window,
            title: 'CodeScope: Analyzing dependencies...',
            cancellable: false
        }, async (progress) => {
            const graph = await buildDependencyGraph();
            const dependencies = graph.getDependencies(fileUri.fsPath);
            dependencyViewProvider.updateView(fileUri, dependencies);
        });
    });

    context.subscriptions.push(inspectCommand);
}

export function deactivate() {}