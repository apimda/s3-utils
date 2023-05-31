import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { GenericContainer, StartedTestContainer } from 'testcontainers';

const startContainerIfNecessary = async () => {
  const portEnv = process.env[StorageTestContext.S3_PORT_ENV_KEY];
  if (portEnv) {
    const port = parseInt(portEnv);
    return { port, container: undefined };
  } else {
    const dockerPort = 4566;
    const container = await new GenericContainer('localstack/localstack')
      .withExposedPorts(dockerPort)
      .withEnvironment({ SERVICES: 's3', AWS_DEFAULT_REGION: StorageTestContext.S3_REGION })
      .start();
    const port = container.getMappedPort(dockerPort);
    return { port, container };
  }
};

export class StorageTestContext {
  public static readonly S3_PORT_ENV_KEY = '__TEST_S3_PORT__';
  public static readonly S3_REGION = 'eu-central-1';
  public static readonly GLOBAL_KEY = '__S3_TEST_CONTEXT__';

  public s3Client: S3Client;

  private constructor(public readonly port: number, private readonly container?: StartedTestContainer) {
    this.s3Client = new S3Client({
      endpoint: `http://localhost:${this.port}`,
      region: StorageTestContext.S3_REGION,
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test'
      },
      forcePathStyle: true
    });
  }

  public static async create() {
    const { port, container } = await startContainerIfNecessary();
    const result = new StorageTestContext(port, container);
    return result;
  }

  public static async createGlobal() {
    const result = await StorageTestContext.create();
    process.env[StorageTestContext.S3_PORT_ENV_KEY] = result.port.toString();
    (globalThis as any)[StorageTestContext.GLOBAL_KEY] = result;
  }

  public static async destroyGlobal() {
    const storageTestContext = (globalThis as any)[StorageTestContext.GLOBAL_KEY] as StorageTestContext;
    await storageTestContext.destroy();
  }

  async createBucket(): Promise<string> {
    const bucket = randomUUID();
    await this.s3Client.send(new CreateBucketCommand({ Bucket: bucket }));
    return bucket;
  }

  async destroy() {
    await this.container?.stop();
  }
}
