import { Router } from 'express';
import {
  askDocument,
  listDocuments,
  searchDocuments,
  updateDocumentMetadata,
  uploadDocument,
  uploadMiddleware,
} from '../controllers/documentController';

const router = Router();

router.post('/upload', uploadMiddleware, uploadDocument);
router.get('/', listDocuments);
router.post('/search', searchDocuments);
router.post('/ask', askDocument);
router.patch('/:documentId', updateDocumentMetadata);

export default router;
