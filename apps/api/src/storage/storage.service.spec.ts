import type { ConfigService } from '@nestjs/config';

import { StorageService } from './storage.service';

function makeService(overrides: Record<string, string> = {}): StorageService {
  const env: Record<string, string> = {
    S3_ENDPOINT: 'http://minio:9000',
    S3_REGION: 'us-east-1',
    S3_ACCESS_KEY: 'test',
    S3_SECRET_KEY: 'test',
    S3_FORCE_PATH_STYLE: 'true',
    S3_PUBLIC_URL: 'http://localhost:9000',
    ...overrides,
  };
  const config = {
    getOrThrow: (key: string) => {
      const v = env[key];
      if (!v) throw new Error(`missing ${key}`);
      return v;
    },
    get: (key: string) => env[key],
  } as unknown as ConfigService;
  return new StorageService(config);
}

describe('StorageService.publicUrl', () => {
  it('uses path-style with S3_PUBLIC_URL when distinct from endpoint', () => {
    const svc = makeService();
    expect(svc.publicUrl('majlis-uploads', 'avatars/u1/small.webp')).toBe(
      'http://localhost:9000/majlis-uploads/avatars/u1/small.webp',
    );
  });

  it('falls back to S3_ENDPOINT when S3_PUBLIC_URL is absent', () => {
    const svc = makeService({ S3_PUBLIC_URL: '' });
    expect(svc.publicUrl('b', 'k')).toBe('http://minio:9000/b/k');
  });

  it('switches to virtual-host style when path style is disabled', () => {
    const svc = makeService({
      S3_FORCE_PATH_STYLE: 'false',
      S3_PUBLIC_URL: 'https://cdn.example.com',
    });
    expect(svc.publicUrl('majlis-uploads', 'x.webp')).toBe(
      'https://majlis-uploads.cdn.example.com/x.webp',
    );
  });

  it('strips trailing slashes from the public base', () => {
    const svc = makeService({ S3_PUBLIC_URL: 'http://localhost:9000/' });
    expect(svc.publicUrl('b', 'k')).toBe('http://localhost:9000/b/k');
  });
});
