import { S3EventRecord } from 'aws-lambda';

export type EventType = 'created' | 'removed' | 'other';

export const getEventType = (eventName: string): EventType => {
  if (eventName.startsWith('ObjectCreated')) {
    return 'created';
  } else if (eventName.startsWith('ObjectRemoved')) {
    return 'removed';
  }
  return 'other';
};

export interface ParsedS3Record {
  eventType: EventType;
  bucket: string;
  key: string;
  size: number;
}

export const parseEventRecord = (record: S3EventRecord): ParsedS3Record => {
  const eventType = getEventType(record.eventName);
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
  const { size } = record.s3.object;
  return { eventType, bucket, key, size };
};
