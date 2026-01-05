import { IDependency } from './dependencyGraph';

/**
 * NOTE: This is a MOCKED AI explanation for the hackathon.
 * It uses simple heuristics and does NOT make a real AI call.
 */
export function getImpactExplanation(dependencies: IDependency[]): string {
    if (dependencies.length === 0) {
        return 'This file appears to have no direct dependents in the workspace. Changes may be low-risk.';
    }

    const fileCount = new Set(dependencies.map(d => d.filePath)).size;

    if (fileCount > 5) {
        return `Warning: This file is a high-impact dependency, affecting ${fileCount} other files. Changes here could have widespread effects. Recommend thorough testing.`;
    }

    if (fileCount > 1) {
        return `This file is a shared dependency for ${fileCount} files. Consider the impact on each before making changes.`;
    }

    return 'This file has a small number of dependents. Changes are likely localized and lower-risk.';
}