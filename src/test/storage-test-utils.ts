import axios from 'axios';
import assert from 'node:assert';
import { Storage } from '../storage.js';

export async function storageTest<TKey>(storage: Storage<TKey>, key: TKey) {
  // test to/from S3 key
  const s3Key = storage.keyConverter.toS3(key);
  assert.deepStrictEqual(storage.keyConverter.fromS3(s3Key), key);

  // put/get/info/exists/delete
  const info = {
    contentType: 'text/plain',
    metadata: {}
  };
  const obj = {
    ...info,
    data: Buffer.from('DATA')
  };
  await storage.putObject(key, obj);
  assert.strictEqual(await storage.exists(key), true);
  assert.deepStrictEqual(await storage.getObject(key), obj);
  assert.deepStrictEqual(await storage.info(key), info);
  await storage.delete(key);
  assert.strictEqual(await storage.exists(key), false);

  // Singed URLs
  const data = 'DATA';
  const putUrl = await storage.signedPutUrl(key, info);
  await axios.put(putUrl, data, {
    headers: { 'content-type': info.contentType }
  });
  assert.strictEqual(await storage.exists(key), true);
  const getUrl = await storage.signedGetUrl(key);
  const getUrlData = (await axios.get(getUrl)).data;
  assert.deepStrictEqual(getUrlData, data);
  await storage.delete(key);
  assert.strictEqual(await storage.exists(key), false);
}
