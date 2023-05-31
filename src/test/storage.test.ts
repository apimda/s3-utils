import { S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';
import { KeyConverter, Storage } from '../storage.js';
import { StorageTestContext } from './storage-test-context.js';
import { storageTest } from './storage-test-utils.js';

interface TestKey {
  kind: 'image' | 'document';
  id: string;
}

const testKeyConverter: KeyConverter<TestKey> = {
  toS3(key: TestKey) {
    return `${key.kind}/${key.id}`;
  },
  fromS3(s3Key: string) {
    const components = s3Key.split('/');
    if (components.length === 2 && (components[0] === 'image' || components[0] === 'document')) {
      return {
        kind: components[0],
        id: components[1]
      };
    }
    throw new Error(`Invalid key: ${s3Key}`);
  }
};

class TestStorage extends Storage<TestKey> {
  constructor(client: S3Client, bucket: string) {
    super(client, bucket, testKeyConverter);
  }
}

let context: StorageTestContext;
let storage: TestStorage;

beforeAll(async () => {
  context = await StorageTestContext.create();
  const bucket = await context.createBucket();
  storage = new TestStorage(context.s3Client, bucket);
});

beforeEach(async () => {
  await storage.deleteAll();
});

afterAll(async () => {
  await context.destroy();
});

describe('TestStorage', () => {
  test('Document test', async () => {
    await storageTest(storage, {
      kind: 'document',
      id: randomUUID()
    });
  });
  test('Image test', async () => {
    await storageTest(storage, {
      kind: 'image',
      id: randomUUID()
    });
  });
});
