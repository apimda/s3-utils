import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  ListObjectsV2CommandInput,
  ObjectIdentifier,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';

export const createS3ClientFromEnv = () => {
  const endpoint = process.env.OG_LOCALSTACK_ENDPOINT;
  const region = process.env.AWS_REGION;
  if (endpoint) {
    return new S3Client({ endpoint, region });
  }
  return new S3Client({ region });
};

export const toBuffer = (stream: Readable) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.once('end', () => resolve(Buffer.concat(chunks)));
    stream.once('error', reject);
  });

export type S3Metadata = Record<Lowercase<string>, string>;

export interface S3ObjectInfo {
  contentType: string;
  metadata?: S3Metadata;
}

export interface S3Object extends S3ObjectInfo {
  data: Buffer;
}

export interface KeyConverter<T> {
  toS3: (key: T) => string;
  fromS3: (s3Key: string) => T;
}

export abstract class Storage<TKey> {
  protected constructor(public client: S3Client, public bucket: string, public keyConverter: KeyConverter<TKey>) {}

  async delete(key: TKey): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.keyConverter.toS3(key) }));
  }

  async deleteAll() {
    await this.deleteList({ Bucket: this.bucket });
  }

  protected async deleteList(listRequest: ListObjectsV2CommandInput) {
    const listObjs = async () => {
      const objs = await this.client.send(new ListObjectsV2Command(listRequest));
      const contents = objs.Contents || [];
      const result: ObjectIdentifier[] = contents.map(o => {
        return { Key: o.Key! };
      });
      return result;
    };

    let objIds = await listObjs();
    while (objIds.length) {
      // const command = new DeleteObjectsCommand({
      //   Bucket: listRequest.Bucket,
      //   Delete: { Objects: objIds },
      // });
      // console.log(JSON.stringify(command, undefined, 2));
      // await this.client.send(command);

      // TODO: weird bug in DeleteObjectsCommand, "exception while calling s3.DeleteObjects: string index out of range"
      // use single, inefficient DeleteObjectCommand instead for now...
      for (const objId of objIds) {
        await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objId.Key }));
      }
      objIds = await listObjs();
    }
  }

  async exists(key: TKey): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.keyConverter.toS3(key) }));
    } catch (e: any) {
      if (e.name === 'NotFound') {
        return false;
      } else {
        throw e;
      }
    }
    return true;
  }

  async info(key: TKey): Promise<S3ObjectInfo | undefined> {
    const response = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: this.keyConverter.toS3(key) })
    );
    const contentType = response.ContentType;
    if (!contentType) {
      return undefined;
    }
    return {
      contentType,
      metadata: response.Metadata
    };
  }

  async getObject(key: TKey): Promise<S3Object | undefined> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: this.keyConverter.toS3(key) })
    );
    const contentType = response.ContentType as string | undefined;
    const metadata = response.Metadata as S3Metadata | undefined;
    const stream = response.Body as Readable | undefined;
    if (!contentType || !stream) {
      return undefined;
    }
    const data = await toBuffer(stream);
    return { contentType, metadata, data };
  }

  async putObject(key: TKey, data: S3Object): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Body: data.data,
        Bucket: this.bucket,
        ContentType: data.contentType,
        Key: this.keyConverter.toS3(key),
        Metadata: data.metadata
      })
    );
  }

  async signedGetUrl(key: TKey, expiresIn = 60): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: this.keyConverter.toS3(key) });
    return await getSignedUrl(this.client, command, { expiresIn });
  }

  async signedPutUrl(key: TKey, info: S3ObjectInfo, expiresIn = 60): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      ContentType: info.contentType,
      Key: this.keyConverter.toS3(key),
      Metadata: info.metadata
    });
    return await getSignedUrl(this.client, command, { expiresIn });
  }
}
