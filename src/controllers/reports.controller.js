import { Expense } from '../models/expense.model.js';
import { Group } from '../models/group.model.js';
import { Payment } from '../models/payment.model.js';
import { Student } from '../models/student.model.js';
import { StudentMonthlyBalance } from '../models/student-monthly-balance.model.js';

const defaultStudentSources = [
  'Instagram',
  'Telegram',
  'Tavsiya',
  'Tashqi reklama',
  'Telefon',
  'Boshqa',
];

function getDateRange(query) {
  const from = query.dateFrom ? new Date(`${query.dateFrom}T00:00:00`) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const to = query.dateTo ? new Date(`${query.dateTo}T23:59:59.999`) : new Date();
  return { from, to };
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function getFinancialReport(req, res) {
  try {
    const { from, to } = getDateRange(req.query);
    const [payments, expenses, debtRows] = await Promise.all([
      Payment.find({ paidAt: { $gte: from, $lte: to }, status: 'active' }).populate('studentId', 'fullName phone'),
      Expense.find({ spentAt: { $gte: from, $lte: to } }),
      StudentMonthlyBalance.aggregate([{ $match: { debtAmount: { $gt: 0 } } }, { $group: { _id: null, total: { $sum: '$debtAmount' } } }]),
    ]);
    const income = payments.reduce((sum, item) => sum + item.amount, 0);
    const expense = expenses.reduce((sum, item) => sum + item.amount, 0);
    return res.json({ from, to, income, expense, net: income - expense, debt: debtRows[0]?.total || 0, paymentsCount: payments.length, expensesCount: expenses.length });
  } catch (error) {
    return res.status(500).json({ message: 'Hisobotni olishda xatolik', error: error.message });
  }
}

export async function getStudentSourceReport(req, res) {
  try {
    const { from, to } = getDateRange(req.query);
    const match = { createdAt: { $gte: from, $lte: to } };
    const rows = await Student.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $cond: [
              { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ['$source', ''] } } } }, 0] },
              { $trim: { input: '$source' } },
              'Boshqa',
            ],
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, _id: 1 } },
    ]);
    const countsBySource = new Map(rows.map((row) => [row._id, row.count]));
    const sourceNames = [
      ...defaultStudentSources,
      ...rows.map((row) => row._id).filter((source) => !defaultStudentSources.includes(source)),
    ];
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    const sources = sourceNames.map((source) => ({
      source,
      count: countsBySource.get(source) || 0,
      percent: total ? Math.round(((countsBySource.get(source) || 0) / total) * 1000) / 10 : 0,
    }));
    const topSource = sources.filter((source) => source.count > 0).sort((a, b) => b.count - a.count)[0] || null;

    return res.json({
      from,
      to,
      total,
      topSource,
      sources,
    });
  } catch (error) {
    return res.status(500).json({ message: "O'quvchilar oqimini olishda xatolik", error: error.message });
  }
}

export async function getCourseStudentReport(_req, res) {
  try {
    const [subjects, rows] = await Promise.all([
      Group.find({ status: 'active' }).distinct('subject'),
      Student.aggregate([
        { $match: { status: { $in: ['active', 'paused'] } } },
        {
          $lookup: {
            from: 'groups',
            localField: 'groupId',
            foreignField: '_id',
            as: 'group',
          },
        },
        { $unwind: { path: '$group', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ['$group.subject', 'Boshqa'] },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1, _id: 1 } },
      ]),
    ]);
    const countsByCourse = new Map(rows.map((row) => [row._id, row.count]));
    const courseNames = [
      ...subjects,
      ...rows.map((row) => row._id).filter((course) => !subjects.includes(course)),
    ];
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    const courses = courseNames.map((course) => ({
      course,
      count: countsByCourse.get(course) || 0,
      percent: total ? Math.round(((countsByCourse.get(course) || 0) / total) * 1000) / 10 : 0,
    }));

    return res.json({ total, courses });
  } catch (error) {
    return res.status(500).json({ message: "Kurslar bo'yicha o'quvchilar hisobotini olishda xatolik", error: error.message });
  }
}

export async function exportFinancialReport(req, res) {
  try {
    const { from, to } = getDateRange(req.query);
    const payments = await Payment.find({ paidAt: { $gte: from, $lte: to }, status: 'active' }).populate('studentId', 'fullName phone').populate('createdBy', 'fullName').sort({ paidAt: -1 });
    const rows = [['Sana', 'O‘quvchi', 'Telefon', 'Summa', 'Usul', 'Holat', 'Kiritgan', 'Izoh']];
    payments.forEach((item) => rows.push([
      item.paidAt.toISOString(), item.studentId?.fullName || '-', item.studentId?.phone || '-', item.amount,
      item.method, item.status, item.createdBy?.fullName || '-', item.note || '',
    ]));
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\n')}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="financial-report-${req.query.dateFrom || 'all'}-${req.query.dateTo || 'today'}.csv"`);
    return res.send(csv);
  } catch (error) {
    return res.status(500).json({ message: 'Eksportda xatolik', error: error.message });
  }
}
