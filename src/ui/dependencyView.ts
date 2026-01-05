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

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview, null, [], undefined);

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

    public updateView(activeFile: vscode.Uri, dependencies: IDependency[], functionName?: string) {
        if (this._view) {
            this._view.show?.(true); 
            this._view.webview.html = this._getHtmlForWebview(this._view.webview, activeFile, dependencies, functionName);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview, activeFile: vscode.Uri | null, dependencies: IDependency[], functionName?: string) {
        const nonce = getNonce();
        const explanation = getImpactExplanation(dependencies);
        const impactLevel = dependencies.length > 5 ? 'High' : (dependencies.length > 0 ? 'Moderate' : 'Low');
        const impactClass = impactLevel.toLowerCase();

        const dependencyListHtml = dependencies.map(dep => {
            const fileName = dep.dependentFilePath.split(/[\\/]/).pop();
            return `
                <div class="dependency-card" data-file="${dep.dependentFilePath}" data-line="${dep.position.line}">
                    <div class="card-header">
                        <span class="codicon codicon-symbol-method"></span>
                        <span class="caller-name">${dep.callerFunction || 'Global Scope'}</span>
                    </div>
                    <div class="card-meta">
                        <span class="file-label">${fileName}</span>
                        <span class="path-label">${vscode.workspace.asRelativePath(dep.dependentFilePath)}</span>
                    </div>
                </div>`;
        }).join('');

        const emptyState = `
            <div class="empty-state">
                <div class="empty-icon">scope</div>
                <p>${functionName ? `No dependents found for "${functionName}".` : 'Place cursor inside a function to analyze.'}</p>
            </div>`;

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    :root {
                        --accent-blue: #007acc;
                        --accent-green: #4ec9b0;
                        --accent-yellow: #dcdcaa;
                        --risk-high: #f14c4c;
                        --card-bg: #252526;
                        --hover-bg: #2a2d2e;
                    }
                    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 12px; font-size: 13px; line-height: 1.4; }
                    .header { margin-bottom: 20px; border-bottom: 1px solid var(--vscode-widget-border); padding-bottom: 12px; }
                    .tool-name { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--accent-blue); font-weight: bold; }
                    .context-title { font-size: 16px; margin: 4px 0; font-weight: 600; }
                    .impact-badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: bold; text-transform: uppercase; margin-top: 8px; }
                    .impact-low { background: #3a3d41; color: #ccc; }
                    .impact-moderate { background: #0e639c; color: white; }
                    .impact-high { background: var(--risk-high); color: white; }
                    .section-label { font-size: 11px; font-weight: bold; color: var(--vscode-descriptionForeground); margin: 16px 0 8px 0; text-transform: uppercase; }
                    .explanation-box { background: var(--vscode-editor-background); border-left: 3px solid var(--accent-blue); padding: 8px 12px; margin-bottom: 16px; font-style: italic; color: var(--vscode-descriptionForeground); }
                    .dependency-card { background: var(--card-bg); border: 1px solid var(--vscode-widget-border); border-radius: 4px; padding: 10px; margin-bottom: 8px; cursor: pointer; transition: background 0.2s; }
                    .dependency-card:hover { background: var(--hover-bg); border-color: var(--accent-blue); }
                    .card-header { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; color: var(--accent-yellow); font-weight: 500; }
                    .card-meta { display: flex; flex-direction: column; gap: 2px; }
                    .file-label { font-weight: 600; color: var(--vscode-foreground); }
                    .path-label { font-size: 11px; color: var(--vscode-descriptionForeground); }
                    .empty-state { text-align: center; padding: 40px 20px; color: var(--vscode-descriptionForeground); }
                    .empty-icon { font-size: 24px; margin-bottom: 12px; opacity: 0.5; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="tool-name">CodeScope Dependency Tracker</div>
                    <div class="context-title">${functionName || 'No function selected'}</div>
                    ${functionName ? `<div class="impact-badge impact-${impactClass}">${impactLevel} Impact</div>` : ''}
                </div>
                
                ${functionName ? `
                    <div class="section-label">Analysis</div>
                    <div class="explanation-box">${explanation}</div>
                    <div class="section-label">Dependents (${dependencies.length})</div>
                    <div class="list-container">
                        ${dependencyListHtml.length > 0 ? dependencyListHtml : emptyState}
                    </div>
                ` : emptyState}

                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    document.querySelectorAll('.dependency-card').forEach(item => {
                        item.addEventListener('click', () => {
                            vscode.postMessage({ 
                                command: 'navigateTo', 
                                file: item.getAttribute('data-file'), 
                                line: parseInt(item.getAttribute('data-line')) 
                            });
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