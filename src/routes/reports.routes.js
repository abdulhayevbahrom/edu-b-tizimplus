import { Router } from 'express';
import { exportFinancialReport, getCourseStudentReport, getFinancialReport, getStudentSourceReport } from '../controllers/reports.controller.js';

const router = Router();
router.get('/finance', getFinancialReport);
router.get('/finance/export', exportFinancialReport);
router.get('/student-sources', getStudentSourceReport);
router.get('/course-students', getCourseStudentReport);
export default router;
