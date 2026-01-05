import * as vscode from 'vscode';
import * as ts from 'typescript';
import { findEnclosingFunction } from './parser';

export interface IDependency {
    // The file that uses the dependency
    dependentFilePath: string;
    // The position of the import statement or function call
    position: { line: number; character: number };
    // The name of the function being imported/called
    targetFunction: string;
    // The name of the function that makes the call, if applicable
    callerFunction?: string;
}

export class DependencyGraph {
    // Key: The path to a file that is being depended on (e.g., '.../utils.ts')
    // Value: A list of dependencies that consume the key file.
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
    const fileContents = new Map<string, string>();

    for (const file of files) {
        const content = (await vscode.workspace.fs.readFile(file)).toString();
        fileContents.set(file.fsPath, content);
    }

    for (const [filePath, content] of fileContents) {
        const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.ES2020, true);

        const importedFunctions = new Map<string, { sourceFile: string }>();

        // First pass: find all imports in the current file
        ts.forEachChild(sourceFile, node => {
            if (ts.isImportDeclaration(node)) {
                const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;
                const resolvedPath = resolvePath(moduleSpecifier, filePath);

                if (resolvedPath && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
                    node.importClause.namedBindings.elements.forEach(element => {
                        const functionName = element.name.text;
                        importedFunctions.set(functionName, { sourceFile: resolvedPath });
                    });
                }
            }
        });

        // Second pass: find where these imported functions are called
        function findCalls(node: ts.Node) {
            if (ts.isCallExpression(node)) {
                const functionName = node.expression.getText(sourceFile);
                if (importedFunctions.has(functionName)) {
                    const importInfo = importedFunctions.get(functionName)!;
                    const callerFunction = findEnclosingFunction(node, sourceFile);
                    const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());

                    graph.addDependency(importInfo.sourceFile, {
                        dependentFilePath: filePath,
                        position: { line: pos.line, character: pos.character },
                        targetFunction: functionName,
                        callerFunction: callerFunction?.name
                    });
                }
            }
            ts.forEachChild(node, findCalls);
        }

        findCalls(sourceFile);
    }

    return graph;
}

function resolvePath(importPath: string, currentFilePath: string): string | null {
    if (!importPath.startsWith('.')) return null;

    const path = require('path');
    const fs = require('fs');
    const resolved = path.resolve(path.dirname(currentFilePath), importPath);

    const extensions = ['.ts', '.js'];
    for (const ext of extensions) {
        if (fs.existsSync(resolved + ext)) {
            return resolved + ext;
        }
    }
    if (fs.existsSync(resolved + '/index.ts')) {
        return resolved + '/index.ts';
    }
    if (fs.existsSync(resolved + '/index.js')) {
        return resolved + '/index.js';
    }

    return resolved + '.ts'; // Fallback for extensionless imports
}