import * as vscode from 'vscode';

export class DependencyPanel {
  public static currentPanel: DependencyPanel | undefined;

  private readonly panel: vscode.WebviewPanel;

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;

    this.panel.onDidDispose(() => {
      DependencyPanel.currentPanel = undefined;
    });
  }

  public static createOrShow(
    extensionUri: vscode.Uri
  ): DependencyPanel {
    if (DependencyPanel.currentPanel) {
      DependencyPanel.currentPanel.panel.reveal(
        vscode.ViewColumn.Beside
      );
      return DependencyPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'codescope',
      'CodeScope – Function Dependencies',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true
      }
    );

    DependencyPanel.currentPanel = new DependencyPanel(panel);
    return DependencyPanel.currentPanel;
  }

  public update(functionName: string): void {
    this.panel.webview.html = this.getHtml(functionName);
  }

  private getHtml(functionName: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: sans-serif;
            padding: 16px;
          }
          h1 {
            margin-bottom: 8px;
          }
        </style>
      </head>
      <body>
        <h1>Hello World</h1>
        <p><strong>Function:</strong> ${functionName}</p>
      </body>
      </html>
    `;
  }
}
