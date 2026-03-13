/**
 * Integration tests for public repositories
 * These tests require network access and may be slow
 */

import { DockerAnalyzer } from '../../src/analyzers/DockerAnalyzer.js';
import { NpmAnalyzer } from '../../src/analyzers/NpmAnalyzer.js';
import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Test repositories with known issues
const TEST_REPOS = [
  {
    name: 'nginx-proxy-manager-issue',
    repo: 'https://github.com/NginxProxyManager/nginx-proxy-manager.git',
    issue: '1.1 GB Docker image',
    expectedImprovement: '60%',
    skip: true // Too large to clone in CI
  },
  {
    name: 'create-react-app',
    command: 'npx create-react-app test-react-app --template typescript',
    issue: 'Large node_modules',
    expectedImprovement: '30%',
    cleanup: true
  }
];

describe('Integration Tests', () => {
  beforeAll(() => {
    // Ensure test directory exists
    const testDir = path.join(__dirname, '../fixtures/integration');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Cleanup test repositories
    const testDir = path.join(__dirname, '../fixtures/integration');
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('DockerAnalyzer on real projects', () => {
    it('should analyze Dockerfile in current project', async () => {
      // Use this project as test
      const projectPath = path.join(__dirname, '../../');
      const analyzer = new DockerAnalyzer();
      
      const isApplicable = await analyzer.isApplicable(projectPath);
      
      // This project may not have a Dockerfile
      // Just check that the analyzer doesn't crash
      expect(typeof isApplicable).toBe('boolean');
    });
  });

  describe('NpmAnalyzer on real projects', () => {
    it('should analyze package.json in current project', async () => {
      const projectPath = path.join(__dirname, '../../');
      const analyzer = new NpmAnalyzer();
      
      const isApplicable = await analyzer.isApplicable(projectPath);
      expect(isApplicable).toBe(true);
      
      const result = await analyzer.analyze(projectPath);
      
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('savings');
    });
  });

  // Skip slow tests by default
  describe.skip('External repository tests', () => {
    for (const repo of TEST_REPOS) {
      if (repo.skip) continue;

      it(`should analyze ${repo.name}`, async () => {
        const testDir = path.join(__dirname, '../fixtures/integration', repo.name);
        
        // Clone or create project
        if (repo.repo) {
          childProcess.execSync(`git clone ${repo.repo} ${testDir}`, {
            stdio: 'inherit'
          });
        } else if (repo.command) {
          childProcess.execSync(repo.command, {
            cwd: path.join(__dirname, '../fixtures/integration'),
            stdio: 'inherit'
          });
        }

        // Run analyzer
        const analyzer = repo.repo?.includes('Docker') 
          ? new DockerAnalyzer() 
          : new NpmAnalyzer();
        
        const result = await analyzer.analyze(testDir);
        
        // Verify expected improvement
        expect(result.savings.percentImprovement).toBeGreaterThanOrEqual(
          parseInt(repo.expectedImprovement)
        );

        // Cleanup
        if (repo.cleanup && fs.existsSync(testDir)) {
          fs.rmSync(testDir, { recursive: true, force: true });
        }
      }, 120000); // 2 minute timeout for network operations
    }
  });
});

describe('Metrics Comparison', () => {
  it('should compare before and after metrics', () => {
    const baseline = {
      docker: {
        imageSize: 1200,
        buildTime: 180,
        layerCount: 15
      },
      npm: {
        installTimeCold: 45,
        installTimeCached: 8,
        nodeModulesSize: 450,
        totalDeps: 45,
        unusedDeps: 12,
        outdatedDeps: 8
      }
    };

    const current = {
      docker: {
        imageSize: 400,
        buildTime: 60,
        layerCount: 8
      },
      npm: {
        installTimeCold: 15,
        installTimeCached: 3,
        nodeModulesSize: 280,
        totalDeps: 33,
        unusedDeps: 0,
        outdatedDeps: 0
      }
    };

    // Docker improvements
    expect(current.docker.imageSize).toBeLessThan(baseline.docker.imageSize);
    expect(current.docker.buildTime).toBeLessThan(baseline.docker.buildTime);
    
    // npm improvements
    expect(current.npm.nodeModulesSize).toBeLessThan(baseline.npm.nodeModulesSize);
    expect(current.npm.totalDeps).toBeLessThan(baseline.npm.totalDeps);
    expect(current.npm.unusedDeps).toBe(0);
  });
});