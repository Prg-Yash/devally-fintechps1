import { Router } from 'express';
import multer from 'multer';
import { uploadFile, deleteFile } from '../controllers/upload.controller';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// POST /upload?folder=deliverables  →  returns { url, key }
router.post('/', upload.single('file'), uploadFile);

// DELETE /upload?key=deliverables/abc.pdf
router.delete('/', deleteFile);

export default router;
