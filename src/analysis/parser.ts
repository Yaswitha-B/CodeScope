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

export function findNodeAtOffset(sourceFile: ts.SourceFile, offset: number): ts.Node | undefined {
    function find(node: ts.Node): ts.Node | undefined {
        if (offset >= node.getStart() && offset <= node.getEnd()) {
            return ts.forEachChild(node, find) || node;
        }
        return undefined;
    }
    return find(sourceFile);
}

/**
 * Traverses up the AST from a given node to find the name of the enclosing function.
 */
export function findEnclosingFunction(node: ts.Node, sourceFile: ts.SourceFile): IFunctionInfo | undefined {
    let current: ts.Node | undefined = node;
    while (current) {
        if (ts.isFunctionDeclaration(current) || ts.isMethodDeclaration(current) || ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
            let name = 'anonymous';
            
            // Check for direct name
            if ((current as any).name && ts.isIdentifier((current as any).name)) {
                name = (current as any).name.text;
            } else {
                // Handle: const foo = () => {}
                let parent = current.parent;
                if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
                    name = parent.name.text;
                }
            }
            
            const pos = sourceFile.getLineAndCharacterOfPosition(current.getStart());
            return { name, position: pos };
        }
        current = current.parent;
    }
    return undefined;
}