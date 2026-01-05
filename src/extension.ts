import * as vscode from 'vscode';
import { DependencyViewProvider } from './ui/dependencyView';
import { buildDependencyGraph } from './analysis/dependencyGraph';
import { findEnclosingFunction, findNodeAtOffset } from './analysis/parser';
import * as ts from 'typescript';

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
            const allDependencies = graph.getDependencies(fileUri.fsPath);

            // UPGRADE 1: Detect function at cursor
            const sourceText = activeEditor.document.getText();
            const sourceFile = ts.createSourceFile(fileUri.fsPath, sourceText, ts.ScriptTarget.ES2020, true);
            const offset = activeEditor.document.offsetAt(activeEditor.selection.active);
            const nodeAtCursor = findNodeAtOffset(sourceFile, offset);
            
            let targetFunctionName: string | undefined;
            if (nodeAtCursor) {
                const func = findEnclosingFunction(nodeAtCursor, sourceFile);
                targetFunctionName = func?.name;
            }

            // Filter existing dependency data to ONLY the target function
            const filteredDeps = targetFunctionName 
                ? allDependencies.filter(d => d.targetFunction === targetFunctionName)
                : [];

            dependencyViewProvider.updateView(fileUri, filteredDeps, targetFunctionName);
        });
    });

    context.subscriptions.push(inspectCommand);
}

export function deactivate() {}