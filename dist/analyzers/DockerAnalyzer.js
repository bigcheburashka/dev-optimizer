/**
 * Docker Analyzer
 * Analyzes Dockerfile for optimization opportunities
 */
import * as fs from 'fs';
import * as path from 'path';
export class DockerAnalyzer {
    name = 'docker';
    async isApplicable(projectPath) {
        const dockerfile = path.join(projectPath, 'Dockerfile');
        const dockerfileLower = path.join(projectPath, 'dockerfile');
        return fs.existsSync(dockerfile) || fs.existsSync(dockerfileLower);
    }
    async analyze(projectPath) {
        const issues = [];
        const suggestions = [];
        let score = 100;
        // Parse Dockerfile
        const dockerfile = await this.readDockerfile(projectPath);
        const dockerignoreExists = await this.checkDockerignore(projectPath);
        // Check for .dockerignore
        if (!dockerignoreExists) {
            issues.push({
                type: 'missing_dockerignore',
                severity: 'high',
                message: 'Missing .dockerignore file',
                suggestion: 'Create .dockerignore with node_modules, .git, etc.',
                documentation: 'https://docs.docker.com/build/building/context/#dockerignore-files'
            });
            score -= 20;
            suggestions.push({
                type: 'create_dockerignore',
                description: 'Create .dockerignore file',
                impact: 'Save 200-500 MB in build context',
                autoFix: true,
                safe: true
            });
        }
        // Check for multistage
        const hasMultistage = this.checkMultistage(dockerfile);
        if (!hasMultistage) {
            issues.push({
                type: 'no_multistage',
                severity: 'high',
                message: 'No multistage build detected',
                suggestion: 'Use multistage build to reduce final image size',
                documentation: 'https://docs.docker.com/build/building/multi-stage/'
            });
            score -= 15;
            suggestions.push({
                type: 'add_multistage',
                description: 'Convert to multistage build',
                impact: 'Save 50-70% image size',
                autoFix: false,
                safe: false
            });
        }
        // Check base image
        const baseImage = this.getBaseImage(dockerfile);
        if (baseImage && !this.isAlpineBase(baseImage)) {
            issues.push({
                type: 'large_base_image',
                severity: 'medium',
                message: `Large base image: ${baseImage}`,
                suggestion: 'Consider using alpine-based image',
                documentation: 'https://hub.docker.com/_/alpine'
            });
            score -= 10;
            suggestions.push({
                type: 'switch_to_alpine',
                description: `Switch from ${baseImage} to alpine`,
                impact: 'Save 100-500 MB',
                autoFix: false,
                safe: false
            });
        }
        // Count layers
        const layerCount = this.countLayers(dockerfile);
        if (layerCount > 10) {
            issues.push({
                type: 'too_many_layers',
                severity: 'low',
                message: `Too many layers: ${layerCount}`,
                suggestion: 'Combine RUN commands to reduce layers',
                documentation: 'https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#minimize-the-number-of-layers'
            });
            score -= Math.min(10, layerCount - 10);
        }
        // Check for cleanup
        const hasCleanup = this.checkCleanup(dockerfile);
        if (!hasCleanup) {
            issues.push({
                type: 'no_cleanup',
                severity: 'medium',
                message: 'No cleanup after apt/apk install',
                suggestion: 'Add cleanup commands: rm -rf /var/lib/apt/lists/*',
                documentation: 'https://docs.docker.com/develop/develop-images/dockerfile_best-practices/'
            });
            score -= 10;
        }
        // Calculate potential savings
        const savings = {
            sizeMB: this.calculateSavings(issues, dockerignoreExists),
            timeSeconds: this.calculateTimeSavings(issues),
            percentImprovement: 0
        };
        savings.percentImprovement = savings.sizeMB > 0 ? Math.round((savings.sizeMB / 1000) * 100) : 0;
        const metrics = {
            imageSize: 1200, // Default estimate
            buildTime: 180,
            layerCount,
            contextSize: dockerignoreExists ? 50 : 500
        };
        return {
            analyzer: 'docker',
            score: Math.max(0, score),
            issues,
            suggestions,
            metrics: { docker: metrics },
            savings
        };
    }
    async readDockerfile(projectPath) {
        const dockerfilePath = path.join(projectPath, 'Dockerfile');
        const dockerfileLowerPath = path.join(projectPath, 'dockerfile');
        const filePath = fs.existsSync(dockerfilePath) ? dockerfilePath : dockerfileLowerPath;
        return fs.readFileSync(filePath, 'utf-8');
    }
    async checkDockerignore(projectPath) {
        return fs.existsSync(path.join(projectPath, '.dockerignore'));
    }
    checkMultistage(dockerfile) {
        return /^FROM\s+\S+\s+AS\s+\S+/m.test(dockerfile);
    }
    getBaseImage(dockerfile) {
        const match = dockerfile.match(/^FROM\s+(\S+)/m);
        return match ? match[1] : null;
    }
    isAlpineBase(image) {
        return image.includes('alpine') || image.includes('distroless') || image.includes('scratch');
    }
    countLayers(dockerfile) {
        const runCount = (dockerfile.match(/^RUN/gm) || []).length;
        const copyCount = (dockerfile.match(/^COPY/gm) || []).length;
        const addCount = (dockerfile.match(/^ADD/gm) || []).length;
        return runCount + copyCount + addCount + 1; // +1 for FROM
    }
    checkCleanup(dockerfile) {
        return /rm\s+-rf\s+\/var\/lib\/apt\/lists/.test(dockerfile) ||
            /rm\s+-rf\s+\/var\/cache\/apk/.test(dockerfile);
    }
    calculateSavings(issues, hasDockerignore) {
        let savings = 0;
        if (issues.some(i => i.type === 'missing_dockerignore')) {
            savings += 300;
        }
        if (issues.some(i => i.type === 'no_multistage')) {
            savings += 500;
        }
        if (issues.some(i => i.type === 'large_base_image')) {
            savings += 200;
        }
        if (issues.some(i => i.type === 'no_cleanup')) {
            savings += 80;
        }
        return savings;
    }
    calculateTimeSavings(issues) {
        let savings = 0;
        if (issues.some(i => i.type === 'missing_dockerignore')) {
            savings += 30; // Smaller context = faster build
        }
        if (issues.some(i => i.type === 'no_multistage')) {
            savings += 60; // Parallel build stages
        }
        return savings;
    }
}
//# sourceMappingURL=DockerAnalyzer.js.map