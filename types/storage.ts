export interface S3Connection {
  id: string;
  name: string;
  endpoint: string;
  region: string;
  bucket?: string;
  accessKeyId: string;
  // secretAccessKey stored encrypted
  createdAt: string;
  userId: string;
  orgId?: string;
}

export interface S3Bucket {
  name: string;
  creationDate?: Date;
}

export interface S3Object {
  key: string;
  size: number;
  lastModified: Date;
  etag?: string;
  contentType?: string;
  isFolder: boolean;
}

export interface S3UploadProgress {
  file: string;
  progress: number;
  done: boolean;
  error?: string;
}
