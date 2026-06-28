import { Router } from 'express';
import { convertLead, createLead, deleteLead, getLeads, updateLead } from '../controllers/leads.controller.js';

const router = Router();

router.get('/', getLeads);
router.post('/', createLead);
router.put('/:id', updateLead);
router.post('/:id/convert', convertLead);
router.delete('/:id', deleteLead);

export default router;
