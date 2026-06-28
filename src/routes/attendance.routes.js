import { Router } from "express";
import {
  getAttendance,
  saveAttendance,
  getAttendanceByMonth,
} from "../controllers/attendance.controller.js";

const router = Router();

router.get("/", getAttendance);
router.get("/month", getAttendanceByMonth);
router.put("/", saveAttendance);

export default router;
