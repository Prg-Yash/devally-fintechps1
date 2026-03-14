import { Request, Response } from 'express';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import s3Client, { S3_BUCKET } from '../config/s3';
import path from 'path';

// ─── Helper: Generate unique S3 key ───
function generateKey(folder: string, originalName: string): string {
  const ext = path.extname(originalName);
  const id = Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 8);
  return `${folder}/${id}${ext}`;
}

// ─── Upload File ───
// POST /upload?folder=deliverables
export const uploadFile = async (req: Request, res: Response) => {
  try {
    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({ error: 'No file provided. Use form field "file".' });
    }

    const folder = (req.query.folder as string) || 'uploads';
    const key = generateKey(folder, file.originalname);

    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));

    const url = `https://${S3_BUCKET}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${key}`;

    res.status(201).json({ url, key, name: file.originalname, size: file.size });
  } catch (error: any) {
    console.error('S3 upload error:', error);
    res.status(500).json({ error: error?.message || 'Upload failed' });
  }
};

// ─── Delete File ───
// DELETE /upload?key=deliverables/abc123.pdf
export const deleteFile = async (req: Request, res: Response) => {
  try {
    const key = req.query.key as string;
    if (!key) {
      return res.status(400).json({ error: 'Query parameter "key" is required' });
    }

    await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));

    res.json({ message: 'Deleted', key });
  } catch (error: any) {
    console.error('S3 delete error:', error);
    res.status(500).json({ error: error?.message || 'Delete failed' });
  }
};
