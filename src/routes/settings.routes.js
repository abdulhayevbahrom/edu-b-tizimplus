import express, { Router } from 'express';
import {
  getBrandingSettings,
  getRooms,
  getSubjects,
  updateBrandingSettings,
  updateRooms,
  uploadBrandLogo,
} from '../controllers/settings.controller.js';
import { authenticate, requireOwner } from '../middleware/auth.js';

const router = Router();

router.get('/branding', getBrandingSettings);
router.get('/subjects', authenticate, getSubjects);
router.get('/rooms', authenticate, getRooms);
router.put('/branding', authenticate, requireOwner, updateBrandingSettings);
router.put('/rooms', authenticate, requireOwner, updateRooms);
router.put(
  '/branding/:brand/logo',
  authenticate,
  requireOwner,
  express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '5mb' }),
  uploadBrandLogo,
);

export default router;
