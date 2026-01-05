import * as vscode from 'vscode';
import * as ts from 'typescript';
import { parseFile } from './parser';

export interface IDependency {
    filePath: string;
    position: { line: number; character: number };
    importedFunction: string;
}

export class DependencyGraph {
    private graph = new Map<string, IDependency[]>();

    addDependency(sourceFile: string, dependency: IDependency) {
        if (!this.graph.has(sourceFile)) {
            this.graph.set(sourceFile, []);
        }
        this.graph.get(sourceFile)?.push(dependency);
    }

    getDependencies(sourceFile: string): IDependency[] {
        return this.graph.get(sourceFile) || [];
    }
}

export async function buildDependencyGraph(): Promise<DependencyGraph> {
    const graph = new DependencyGraph();
    const files = await vscode.workspace.findFiles('**/*.{ts,js}', '**/node_modules/**');

    for (const file of files) {
        const content = (await vscode.workspace.fs.readFile(file)).toString();
        const sourceFile = ts.createSourceFile(file.fsPath, content, ts.ScriptTarget.ES2020, true);
        
        ts.forEachChild(sourceFile, node => {
            if (ts.isImportDeclaration(node)) {
                const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;
                const resolvedPath = resolvePath(moduleSpecifier, file.fsPath);

                if (resolvedPath && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
                    node.importClause.namedBindings.elements.forEach(element => {
                        const pos = sourceFile.getLineAndCharacterOfPosition(element.getStart());
                        graph.addDependency(resolvedPath, {
                            filePath: file.fsPath,
                            position: { line: pos.line, character: pos.character },
                            importedFunction: element.name.text
                        });
                    });
                }
            }
        });
    }
    return graph;
}

function resolvePath(importPath: string, currentFilePath: string): string | null {
    // This is a simplified resolver. A real implementation would be more robust.
    if (!importPath.startsWith('.')) return null; // Ignore node_modules for this demo

    const path = require('path');
    const resolved = path.resolve(path.dirname(currentFilePath), importPath);

    // Check for .ts, .js, or index files
    const extensions = ['.ts', '.js'];
    for (const ext of extensions) {
        if (require('fs').existsSync(resolved + ext)) {
            return resolved + ext;
        }
    }
    if (require('fs').existsSync(resolved + '/index.ts')) {
        return resolved + '/index.ts';
    }
    if (require('fs').existsSync(resolved + '/index.js')) {
        return resolved + '/index.js';
    }

    return null;
}