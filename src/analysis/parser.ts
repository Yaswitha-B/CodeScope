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