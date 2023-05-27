import { StorageTestContext } from './packages/test/src/storage-test-context.js';

export async function setup() {
  await StorageTestContext.createGlobal();
}

export async function teardown() {
  await StorageTestContext.destroyGlobal();
}
