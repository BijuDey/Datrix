import { NextRequest, NextResponse } from "next/server";
import { createUserServerClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

async function getS3Client(config: any): Promise<{ client: S3Client; bucket: string }> {
  const clientConfig: any = {
    region: config.region || "us-east-1",
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  };

  if (config.endpoint) {
    clientConfig.endpoint = config.endpoint;
    clientConfig.forcePathStyle = true;
  }

  return {
    client: new S3Client(clientConfig),
    bucket: config.bucket,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createUserServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const action = request.nextUrl.searchParams.get("action");
    const prefix = request.nextUrl.searchParams.get("prefix") || "";
    const key = request.nextUrl.searchParams.get("key") || "";
    const filename = request.nextUrl.searchParams.get("filename") || "";

    const { data: connection, error: dbError } = await supabase
      .from("database_connections")
      .select("id, type, encrypted_config")
      .eq("id", id)
      .single();

    if (dbError || !connection || connection.type !== "s3") {
      return NextResponse.json(
        { error: "S3 connection not found" },
        { status: 404 }
      );
    }

    const config = JSON.parse(decrypt(connection.encrypted_config));
    const { client, bucket } = await getS3Client(config);

    // List objects in a bucket prefix (folder)
    if (action === "list") {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        Delimiter: "/",
        MaxKeys: 1000,
      });

      const response = await client.send(command);

      const folders = (response.CommonPrefixes || []).map((cp) => ({
        type: "folder" as const,
        key: cp.Prefix!,
        name: cp.Prefix!.replace(prefix, "").replace(/\/$/, ""),
      }));

      const files = (response.Contents || [])
        .filter((obj) => obj.Key !== prefix) // exclude the "folder" itself
        .map((obj) => ({
          type: "file" as const,
          key: obj.Key!,
          name: obj.Key!.replace(prefix, ""),
          size: obj.Size ?? 0,
          lastModified: obj.LastModified?.toISOString() ?? null,
          etag: obj.ETag?.replace(/"/g, "") ?? null,
        }));

      return NextResponse.json({
        prefix,
        bucket,
        folders,
        files,
        isTruncated: response.IsTruncated ?? false,
        keyCount: response.KeyCount ?? 0,
      });
    }

    // Generate a presigned download URL
    if (action === "presign-download") {
      if (!key) {
        return NextResponse.json({ error: "key is required" }, { status: 400 });
      }
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentDisposition: filename
          ? `attachment; filename="${filename}"`
          : undefined,
      });
      const url = await getSignedUrl(client, command, { expiresIn: 3600 });
      return NextResponse.json({ url });
    }

    // Generate a presigned upload URL
    if (action === "presign-upload") {
      if (!key) {
        return NextResponse.json({ error: "key is required" }, { status: 400 });
      }
      const contentType =
        request.nextUrl.searchParams.get("contentType") || "application/octet-stream";
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
      });
      const url = await getSignedUrl(client, command, { expiresIn: 3600 });
      return NextResponse.json({ url });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    console.error("[S3 API]", err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createUserServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { key } = await request.json();

    if (!key) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    const { data: connection, error: dbError } = await supabase
      .from("database_connections")
      .select("id, type, encrypted_config")
      .eq("id", id)
      .single();

    if (dbError || !connection || connection.type !== "s3") {
      return NextResponse.json(
        { error: "S3 connection not found" },
        { status: 404 }
      );
    }

    const config = JSON.parse(decrypt(connection.encrypted_config));
    const { client, bucket } = await getS3Client(config);

    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    return NextResponse.json({ success: true, key });
  } catch (err: any) {
    console.error("[S3 DELETE]", err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
