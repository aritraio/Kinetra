import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createDemoRepositories } from '../packages/domain/src/demo-repository';
import { getAccountDatabase, OfflineFirstRepositories } from '../apps/web/src/offline';

describe('Phase 9 — P9-04 Optional Progress Photos Lifecycle & Privacy Retention', () => {
  const aliceId = 'alice-photo-test-id';

  describe('In-Memory Demo Repositories', () => {
    it('enforces opt-in consent gate before storing photos', async () => {
      const repos = createDemoRepositories('maya');

      // Initial state: consent is false
      const initialConsent = await repos.photos.getConsent();
      expect(initialConsent).toBe(false);

      // Attempting to save without consent fails
      await expect(
        repos.photos.savePhoto({
          id: 'photo-1',
          url: 'blob:http://localhost:5173/photo-1',
          captured_at: new Date().toISOString(),
          notes: 'Week 1 check-in',
        }),
      ).rejects.toThrow('Photo consent required before saving photos');
    });

    it('enforces 30-day retention calculation on stored photos', async () => {
      const repos = createDemoRepositories('maya');
      await repos.photos.setConsent(true);

      const capturedAt = new Date().toISOString();
      await repos.photos.savePhoto({
        id: 'photo-retention-test',
        url: 'blob:http://localhost:5173/retention-test',
        captured_at: capturedAt,
      });

      const photos = await repos.photos.listPhotos();
      expect(photos).toHaveLength(1);
      const photo = photos[0]!;

      expect(photo.id).toBe('photo-retention-test');
      expect(photo.expires_at).toBeDefined();

      const capTime = new Date(photo.captured_at).getTime();
      const expTime = new Date(photo.expires_at).getTime();
      const diffDays = Math.round((expTime - capTime) / (86400 * 1000));
      expect(diffDays).toBe(30);
    });

    it('supports individual photo deletion', async () => {
      const repos = createDemoRepositories('maya');
      await repos.photos.setConsent(true);

      await repos.photos.savePhoto({
        id: 'photo-a',
        url: 'blob:http://localhost:5173/photo-a',
        captured_at: new Date().toISOString(),
      });
      await repos.photos.savePhoto({
        id: 'photo-b',
        url: 'blob:http://localhost:5173/photo-b',
        captured_at: new Date().toISOString(),
      });

      let photos = await repos.photos.listPhotos();
      expect(photos).toHaveLength(2);

      await repos.photos.deletePhoto('photo-a');
      photos = await repos.photos.listPhotos();
      expect(photos).toHaveLength(1);
      expect(photos[0]?.id).toBe('photo-b');
    });

    it('immediately and permanently purges all photos when consent is revoked', async () => {
      const repos = createDemoRepositories('maya');
      await repos.photos.setConsent(true);

      await repos.photos.savePhoto({
        id: 'photo-purge-1',
        url: 'blob:http://localhost:5173/purge-1',
        captured_at: new Date().toISOString(),
      });
      await repos.photos.savePhoto({
        id: 'photo-purge-2',
        url: 'blob:http://localhost:5173/purge-2',
        captured_at: new Date().toISOString(),
      });

      expect(await repos.photos.listPhotos()).toHaveLength(2);

      // User revokes consent
      await repos.photos.setConsent(false);

      // All photos must be completely purged
      const photosAfterRevoke = await repos.photos.listPhotos();
      expect(photosAfterRevoke).toHaveLength(0);
      expect(await repos.photos.getConsent()).toBe(false);
    });
  });

  describe('Offline-First IndexedDB Repositories', () => {
    it('persists consent and purge mechanics across offline storage', async () => {
      const db = getAccountDatabase(aliceId);
      const mockRemote = {
        saveProfile: async () => {
          throw new Error('Not used');
        },
        getProfile: async () => null,
        saveLog: async () => {
          throw new Error('Not used');
        },
        getLogs: async () => [],
      };
      const offlineRepos = new OfflineFirstRepositories({
        db,
        ownerId: aliceId,
        remote: mockRemote,
      });

      // Default consent is false
      expect(await offlineRepos.photos.getConsent()).toBe(false);

      // Enable consent
      await offlineRepos.photos.setConsent(true);
      expect(await offlineRepos.photos.getConsent()).toBe(true);

      // Save photo
      await offlineRepos.photos.savePhoto({
        id: 'offline-photo-1',
        url: 'blob:http://localhost:5173/offline-photo-1',
        captured_at: new Date().toISOString(),
        notes: 'Offline captured progress',
      });

      const photos = await offlineRepos.photos.listPhotos();
      expect(photos).toHaveLength(1);
      expect(photos[0]?.notes).toBe('Offline captured progress');

      // Revoking consent purges offline photos table
      await offlineRepos.photos.setConsent(false);
      expect(await offlineRepos.photos.listPhotos()).toHaveLength(0);
      db.close();
    });
  });
});
