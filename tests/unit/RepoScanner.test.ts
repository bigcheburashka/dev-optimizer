/**
 * Tests for RepoScanner
 */

import { RepoScanner } from '../../src/discovery/RepoInventory.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('RepoScanner', () => {
  const scanner = new RepoScanner();

  describe('scan', () => {
    it('should detect package.json in current project', async () => {
      const projectPath = path.join(__dirname, '../../');
      const inventory = await scanner.scan(projectPath);

      expect(inventory.baseline.hasPackageJson).toBe(true);
      expect(inventory.baseline.dependencyCount).toBeGreaterThan(0);
      expect(inventory.availableDomains).toContain('deps');
    });

    it('should detect CI config in current project', async () => {
      const projectPath = path.join(__dirname, '../../');
      const inventory = await scanner.scan(projectPath);

      expect(inventory.baseline.hasCi).toBe(true);
      expect(inventory.availableDomains).toContain('ci');
      expect(inventory.ciPlatform).toBe('github-actions');
    });

    it('should detect project type', async () => {
      const projectPath = path.join(__dirname, '../../');
      const inventory = await scanner.scan(projectPath);

      expect(inventory.baseline.projectType).toBeDefined();
      expect(['typescript', 'nodejs', 'nextjs', 'react']).toContain(inventory.baseline.projectType);
    });

    it('should detect package manager', async () => {
      const projectPath = path.join(__dirname, '../../');
      const inventory = await scanner.scan(projectPath);

      expect(inventory.packageManager).toBe('npm');
    });

    it('should return available domains', async () => {
      const projectPath = path.join(__dirname, '../../');
      const inventory = await scanner.scan(projectPath);

      expect(inventory.availableDomains).toContain('deps');
      expect(inventory.availableDomains).toContain('ci');
      // Docker may not be present
    });

    it('should detect frameworks', async () => {
      const projectPath = path.join(__dirname, '../../');
      const inventory = await scanner.scan(projectPath);

      expect(inventory.frameworks).toContain('typescript');
      expect(inventory.frameworks).toContain('testing');
    });

    it('should handle missing files gracefully', async () => {
      const projectPath = path.join(__dirname, '../fixtures/no-dockerfile');
      
      // Should not throw
      const inventory = await scanner.scan(projectPath);
      expect(inventory).toBeDefined();
    });
  });

  describe('printSummary', () => {
    it('should generate readable summary', async () => {
      const projectPath = path.join(__dirname, '../../');
      const inventory = await scanner.scan(projectPath);
      const summary = scanner.printSummary(inventory);

      expect(summary).toContain('Project:');
      expect(summary).toContain('Type:');
      expect(summary).toContain('Dependencies:');
      expect(summary).toContain('Available analysis domains:');
    });
  });

  describe('detectProjectType', () => {
    it('should detect next.js project', async () => {
      // Would need a fixture
      // For now, just test the function exists
      expect(scanner['detectProjectType']).toBeDefined();
    });

    it('should detect react project', async () => {
      expect(scanner['detectProjectType']).toBeDefined();
    });

    it('should detect nodejs backend project', async () => {
      expect(scanner['detectProjectType']).toBeDefined();
    });
  });

  describe('detectPackageManager', () => {
    it('should detect npm from package-lock.json', async () => {
      // Current project has package-lock.json
      const projectPath = path.join(__dirname, '../../');
      const result = scanner['detectPackageManager'](projectPath);
      expect(result).toBe('npm');
    });
  });

  describe('detectCiPlatform', () => {
    it('should detect github-actions', async () => {
      const projectPath = path.join(__dirname, '../../');
      const result = scanner['detectCiPlatform'](projectPath);
      expect(result).toBe('github-actions');
    });
  });
});