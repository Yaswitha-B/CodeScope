import * as vscode from 'vscode';
import { IDependency } from '../analysis/dependencyGraph';
import { getImpactExplanation } from '../analysis/ai';

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

        const dependencyListHtml = dependencies.map(dep => {
            const fileName = dep.dependentFilePath.split(/[\\/]/).pop();
            const relation = dep.callerFunction 
                ? `<span class="caller">${dep.callerFunction}</span> calls <span class="target">${dep.targetFunction}</span>`
                : `File imports <span class="target">${dep.targetFunction}</span>`;

            return `
                <li class="dependency-item" data-file="${dep.dependentFilePath}" data-line="${dep.position.line}">
                    <div class="file-name">${fileName}</div>
                    <div class="relation">${relation}</div>
                    <div class="file-path">${vscode.workspace.asRelativePath(dep.dependentFilePath)}</div>
                </li>
            `;
        }).join('');

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Dependency Inspector</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ccc; }
                    h3 { padding-left: 8px; }
                    .explanation { padding: 10px; border-bottom: 1px solid #555; font-size: 0.9em; }
                    ul { list-style: none; padding: 0; margin: 0; }
                    .dependency-item { padding: 8px; cursor: pointer; border-bottom: 1px solid #333; }
                    .dependency-item:hover { background-color: #333; }
                    .file-name { font-weight: bold; }
                    .relation { font-size: 0.9em; }
                    .caller { color: #dcdcaa; }
                    .target { color: #9cdcfe; }
                    .file-path { display: block; font-size: 0.8em; color: #888; }
                </style>
            </head>
            <body>
                <h3>${activeFile ? `Dependents of ${activeFile.fsPath.split(/[\\/]/).pop()}` : 'CodeScope Inspector'}</h3>
                <div class="explanation">${explanation}</div>
                <ul>${dependencyListHtml.length > 0 ? dependencyListHtml : '<li>No calling functions found in the workspace.</li>'}</ul>
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

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}