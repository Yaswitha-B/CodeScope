import * as vscode from 'vscode';
import { IDependency } from '../analysis/dependencyGraph';
import { getImpactExplanation } from '../analysis/ai';

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}


export class DependencyViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'codescope.dependencyView';

    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview, null, []);

        webviewView.webview.onDidReceiveMessage(data => {
            if (data.command === 'navigateTo') {
                const { file, line } = data;
                const uri = vscode.Uri.file(file);
                vscode.workspace.openTextDocument(uri).then(doc => {
                    vscode.window.showTextDocument(doc, { 
                        selection: new vscode.Range(line, 0, line, 0) 
                    });
                });
            }
        });
    }

    public updateView(activeFile: vscode.Uri, dependencies: IDependency[]) {
        if (this._view) {
            this._view.show?.(true); 
            this._view.webview.html = this._getHtmlForWebview(this._view.webview, activeFile, dependencies);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview, activeFile: vscode.Uri | null, dependencies: IDependency[]) {
        const nonce = getNonce();
        const explanation = getImpactExplanation(dependencies);

        const dependencyListHtml = dependencies.map(dep => `
            <li class="dependency-item" data-file="${dep.filePath}" data-line="${dep.position.line}">
                <span class="file-name">${dep.filePath.split(/[\\/]/).pop()}</span>
                <span class="function-name">imports ${dep.importedFunction}</span>
                <span class="file-path">${vscode.workspace.asRelativePath(dep.filePath)}</span>
            </li>
        `).join('');

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Dependency Inspector</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
                    .explanation { padding: 10px; border-bottom: 1px solid #555; }
                    ul { list-style: none; padding: 0; }
                    .dependency-item { padding: 8px; cursor: pointer; border-bottom: 1px solid #333; }
                    .dependency-item:hover { background-color: #333; }
                    .file-name { font-weight: bold; }
                    .function-name { color: #ccc; margin-left: 10px; }
                    .file-path { display: block; font-size: 0.8em; color: #888; }
                </style>
            </head>
            <body>
                <h3>${activeFile ? `Dependencies for ${activeFile.fsPath.split(/[\\/]/).pop()}` : 'CodeScope Inspector'}</h3>
                <div class="explanation">${explanation}</div>
                <ul>${dependencyListHtml.length > 0 ? dependencyListHtml : '<li>No dependencies found in the workspace.</li>'}</ul>
                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    document.querySelectorAll('.dependency-item').forEach(item => {
                        item.addEventListener('click', () => {
                            const file = item.getAttribute('data-file');
                            const line = parseInt(item.getAttribute('data-line'));
                            vscode.postMessage({ command: 'navigateTo', file, line });
                        });
                    });
                </script>
            </body>
            </html>`;
    }
}