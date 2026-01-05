import * as ts from 'typescript';

export interface IFunctionInfo {
    name: string;
    position: { line: number; character: number };
}

export function parseFile(filePath: string, content: string): IFunctionInfo[] {
    const functions: IFunctionInfo[] = [];
    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.ES2020, true);

    function visit(node: ts.Node) {
        if (ts.isFunctionDeclaration(node) && node.name) {
            const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            functions.push({ name: node.name.text, position: pos });
        }
        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return functions;
}

/**
 * Traverses up the AST from a given node to find the name of the enclosing function.
 */
export function findEnclosingFunction(node: ts.Node, sourceFile: ts.SourceFile): IFunctionInfo | undefined {
    let current = node.parent;
    while (current) {
        if (ts.isFunctionDeclaration(current) || ts.isMethodDeclaration(current) || ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
            let name = 'anonymous';
            if (current.name && ts.isIdentifier(current.name)) {
                name = current.name.text;
            } else if (ts.isVariableDeclaration(current.parent.parent) && ts.isIdentifier(current.parent.parent.name)) {
                // Handle const myFunction = () => { ... }
                name = current.parent.parent.name.text;
            }
            
            const pos = sourceFile.getLineAndCharacterOfPosition(current.getStart());
            return { name, position: pos };
        }
        current = current.parent;
    }
    return undefined;
}