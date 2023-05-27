import { Storage } from '@apimda/s3-utils-core';
import axios from 'axios';
import { expect } from 'vitest';

export async function storageTest<TKey>(storage: Storage<TKey>, key: TKey) {
  // test to/from S3 key
  const s3Key = storage.keyConverter.toS3(key);
  expect(storage.keyConverter.fromS3(s3Key)).toStrictEqual(key);

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
  expect(await storage.exists(key)).toBe(true);
  expect(await storage.getObject(key)).toEqual(obj);
  expect(await storage.info(key)).toEqual(info);
  await storage.delete(key);
  expect(await storage.exists(key)).toBe(false);

  // Singed URLs
  const data = 'DATA';
  const putUrl = await storage.signedPutUrl(key, info);
  await axios.put(putUrl, data, {
    headers: { 'content-type': info.contentType }
  });
  expect(await storage.exists(key)).toBe(true);
  const getUrl = await storage.signedGetUrl(key);
  const getUrlData = (await axios.get(getUrl)).data;
  expect(getUrlData).toBe(data);
  await storage.delete(key);
  expect(await storage.exists(key)).toBe(false);
}
