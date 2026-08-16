import { Router } from 'express';
import { mcpFetchUrl, mcpLinkedinSearch, mcpWebSearch } from '../controllers/mcpController';

const router = Router();

router.post('/search', mcpWebSearch);
router.post('/linkedin', mcpLinkedinSearch);
router.post('/fetch', mcpFetchUrl);

export default router;
