import { Attendance } from '../models/attendance.model.js';
import { Group } from '../models/group.model.js';
import { Student } from '../models/student.model.js';

const attendanceStatuses = ['present', 'absent', 'late', 'excused'];

function parseAttendanceDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseAttendanceMonth(value) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month] = value.split('-').map(Number);

  if (month < 1 || month > 12) {
    return null;
  }

  const start = new Date(Date.UTC(year, month - 1, 1));

  if (Number.isNaN(start.getTime())) {
    return null;
  }

  const end = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return { value, start, end, daysInMonth };
}

function formatAttendanceDate(date) {
  return date.toISOString().slice(0, 10);
}

function isFutureDate(date) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return date.getTime() > today.getTime();
}

async function findAllowedGroup(groupId, user) {
  const filter = { _id: groupId };

  if (user?.role === 'teacher' && user.teacherId) {
    filter.teacherId = user.teacherId;
  }

  return Group.findOne(filter).populate('teacherId');
}

function isStudentInGroup(student, groupId) {
  const targetGroupId = groupId.toString();
  const primaryGroupId = student.groupId?._id?.toString() || student.groupId?.toString();

  if (primaryGroupId === targetGroupId && ['active', 'paused'].includes(student.status)) {
    return true;
  }

  return (student.enrollments || []).some((enrollment) => {
    const enrollmentGroupId = enrollment.groupId?._id?.toString() || enrollment.groupId?.toString();
    return enrollmentGroupId === targetGroupId && enrollment.status === 'active' && ['active', 'paused'].includes(student.status);
  });
}

function toTeacherResponse(teacher) {
  if (!teacher) return null;

  return {
    id: teacher._id.toString(),
    fullName: teacher.fullName,
    subject: teacher.subject,
    phone: teacher.phone,
    telegram: teacher.telegram,
    gender: teacher.gender,
    experienceYears: teacher.experienceYears,
    status: teacher.status,
    note: teacher.note,
    groupsCount: 0,
    createdAt: teacher.createdAt,
    updatedAt: teacher.updatedAt,
  };
}

function toGroupResponse(group) {
  if (!group) return null;

  return {
    id: group._id.toString(),
    name: group.name,
    subject: group.subject,
    teacherId: group.teacherId?._id?.toString() || group.teacherId?.toString(),
    teacher: toTeacherResponse(group.teacherId),
    room: group.room,
    lessonDays: group.lessonDays,
    startTime: group.startTime,
    endTime: group.endTime,
    startDate: group.startDate || group.createdAt,
    monthlyPrice: group.monthlyPrice,
    isEnrollmentOpen: group.isEnrollmentOpen !== false,
    endedAt: group.endedAt || null,
    note: group.note,
    studentsCount: 0,
    status: group.status,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}

function toStudentSummary(student) {
  return {
    id: student._id.toString(),
    fullName: student.fullName,
    phone: student.phone,
    secondaryPhone: student.secondaryPhone,
    parentName: student.parentName,
    parentPhone: student.parentPhone,
    status: student.status,
  };
}

function toAttendanceResponse(record) {
  if (!record) return null;

  return {
    id: record._id.toString(),
    groupId: record.groupId?.toString(),
    studentId: record.studentId?.toString(),
    date: formatAttendanceDate(record.date),
    status: record.status,
    note: record.note || '',
    markedBy: record.markedBy?.toString() || null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function buildSummary(entries) {
  return entries.reduce(
    (summary, entry) => {
      summary.total += 1;
      summary[entry.status] = (summary[entry.status] || 0) + 1;
      return summary;
    },
    { total: 0, present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 },
  );
}

async function buildAttendancePayload(group, date) {
  const [students, records] = await Promise.all([
    Student.find({
      status: { $in: ['active', 'paused'] },
      $or: [
        { groupId: group._id },
        { enrollments: { $elemMatch: { groupId: group._id, status: 'active' } } },
      ],
    }).sort({ fullName: 1 }),
    Attendance.find({ groupId: group._id, date }),
  ]);

  const recordMap = new Map(records.map((record) => [record.studentId.toString(), record]));
  const entries = students.map((student) => {
    const record = recordMap.get(student._id.toString());

    return {
      student: toStudentSummary(student),
      attendance: toAttendanceResponse(record),
      status: record?.status || 'unmarked',
      note: record?.note || '',
    };
  });

  return {
    group: toGroupResponse(group),
    date: formatAttendanceDate(date),
    entries,
    summary: buildSummary(entries),
  };
}

async function buildMonthlyAttendancePayload(group, month) {
  const [students, records] = await Promise.all([
    Student.find({
      status: { $in: ['active', 'paused'] },
      $or: [
        { groupId: group._id },
        { enrollments: { $elemMatch: { groupId: group._id, status: 'active' } } },
      ],
    }).sort({ fullName: 1 }),
    Attendance.find({
      groupId: group._id,
      date: { $gte: month.start, $lt: month.end },
    }).sort({ date: 1 }),
  ]);

  const recordsByStudent = new Map();

  records.forEach((record) => {
    const studentId = record.studentId.toString();
    const day = Number(formatAttendanceDate(record.date).slice(8, 10));

    if (!recordsByStudent.has(studentId)) {
      recordsByStudent.set(studentId, {});
    }

    recordsByStudent.get(studentId)[day] = {
      attendance: toAttendanceResponse(record),
      status: record.status,
      note: record.note || '',
    };
  });

  const studentsPayload = students.map((student) => {
    const studentId = student._id.toString();
    const dayRecords = recordsByStudent.get(studentId) || {};
    const summary = { total: 0, present: 0, absent: 0, late: 0, excused: 0 };

    Object.values(dayRecords).forEach((record) => {
      summary.total += 1;
      summary[record.status] = (summary[record.status] || 0) + 1;
    });

    return {
      student: toStudentSummary(student),
      records: dayRecords,
      summary,
    };
  });

  return {
    group: toGroupResponse(group),
    month: month.value,
    daysInMonth: month.daysInMonth,
    students: studentsPayload,
  };
}

export async function getAttendance(req, res) {
  try {
    const { groupId, date: dateValue } = req.query;
    const date = parseAttendanceDate(dateValue);

    if (!groupId) {
      return res.status(400).json({ message: 'Guruh tanlanishi kerak' });
    }

    if (!date) {
      return res.status(400).json({ message: "Sana YYYY-MM-DD ko'rinishida bo'lishi kerak" });
    }

    const group = await findAllowedGroup(groupId, req.user);

    if (!group) {
      return res.status(404).json({ message: 'Guruh topilmadi' });
    }

    return res.json(await buildAttendancePayload(group, date));
  } catch (error) {
    return res.status(500).json({ message: 'Davomatni olishda xatolik', error: error.message });
  }
}

export async function getAttendanceByMonth(req, res) {
  try {
    const { groupId, month: monthValue } = req.query;
    const month = parseAttendanceMonth(monthValue);

    if (!groupId) {
      return res.status(400).json({ message: 'Guruh tanlanishi kerak' });
    }

    if (!month) {
      return res.status(400).json({ message: "Oy YYYY-MM ko'rinishida bo'lishi kerak" });
    }

    const group = await findAllowedGroup(groupId, req.user);

    if (!group) {
      return res.status(404).json({ message: 'Guruh topilmadi' });
    }

    return res.json(await buildMonthlyAttendancePayload(group, month));
  } catch (error) {
    return res.status(500).json({ message: 'Davomatni olishda xatolik', error: error.message });
  }
}

export async function saveAttendance(req, res) {
  try {
    const { groupId, date: dateValue, records } = req.body;
    const date = parseAttendanceDate(dateValue);

    if (!groupId) {
      return res.status(400).json({ message: 'Guruh tanlanishi kerak' });
    }

    if (!date) {
      return res.status(400).json({ message: "Sana YYYY-MM-DD ko'rinishida bo'lishi kerak" });
    }

    if (isFutureDate(date)) {
      return res.status(400).json({ message: "Kelasi kunlar uchun davomat qilib bo'lmaydi" });
    }

    if (!Array.isArray(records)) {
      return res.status(400).json({ message: "Davomat ro'yxati yuborilishi kerak" });
    }

    const group = await findAllowedGroup(groupId, req.user);

    if (!group) {
      return res.status(404).json({ message: 'Guruh topilmadi' });
    }

    const studentIds = [...new Set(records.map((record) => record.studentId).filter(Boolean))];
    const students = await Student.find({ _id: { $in: studentIds } });
    const studentMap = new Map(students.map((student) => [student._id.toString(), student]));

    for (const record of records) {
      if (!record.studentId || !attendanceStatuses.includes(record.status)) {
        return res.status(400).json({ message: "Har bir o'quvchi uchun to'g'ri holat tanlanishi kerak" });
      }

      const student = studentMap.get(record.studentId);

      if (!student || !isStudentInGroup(student, group._id)) {
        return res.status(400).json({ message: "Davomatdagi o'quvchi tanlangan guruhga tegishli emas" });
      }
    }

    await Promise.all(
      records.map((record) =>
        Attendance.findOneAndUpdate(
          { groupId: group._id, studentId: record.studentId, date },
          {
            groupId: group._id,
            studentId: record.studentId,
            date,
            status: record.status,
            note: record.note?.trim() || '',
            markedBy: req.user?._id || null,
          },
          { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
        ),
      ),
    );

    return res.json(await buildAttendancePayload(group, date));
  } catch (error) {
    return res.status(500).json({ message: 'Davomatni saqlashda xatolik', error: error.message });
  }
}
