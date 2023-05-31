import { StorageTestContext } from './src/test/storage-test-context.js';

export async function setup() {
  await StorageTestContext.createGlobal();
}

export async function teardown() {
  await StorageTestContext.destroyGlobal();
}
