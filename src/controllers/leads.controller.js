import { Group } from "../models/group.model.js";
import { Lead } from "../models/lead.model.js";
import { Student } from "../models/student.model.js";
import { normalizeUzPhone } from "../utils/phone.js";

const leadStatuses = [
  "new",
  "contacted",
  "interested",
  "trial_scheduled",
  "trial_attended",
  "ready_to_enroll",
  "converted",
  "lost",
];
const closedLeadStatuses = ["converted", "lost"];

function getPagination(query) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(
    Math.max(Number.parseInt(query.limit, 10) || 20, 1),
    100,
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeLeadPayload(body) {
  return {
    fullName: body.fullName?.trim(),
    phone: normalizeUzPhone(body.phone),
    secondaryPhone: body.secondaryPhone
      ? normalizeUzPhone(body.secondaryPhone)
      : "",
    parentName: body.parentName?.trim() || "",
    parentPhone: body.parentPhone ? normalizeUzPhone(body.parentPhone) : "",
    subject: body.subject?.trim(),
    source: body.source?.trim() || "",
    status: leadStatuses.includes(body.status) ? body.status : "new",
    assignedTo: body.assignedTo || null,
    preferredGroupId: body.preferredGroupId || null,
    trialGroupId: body.trialGroupId || null,
    trialDate: parseDate(body.trialDate),
    nextContactAt: parseDate(body.nextContactAt),
    lostReason: body.lostReason?.trim() || "",
    note: body.note?.trim() || "",
  };
}

function validateLeadPayload(payload) {
  if (!payload.fullName) return "Lead F.I.Sh kiritilishi kerak";
  if (!payload.phone) return "Telefon raqam kiritilishi kerak";
  if (payload.secondaryPhone && payload.secondaryPhone === payload.phone)
    return "Ikkinchi telefon asosiy telefon bilan bir xil bo‘lmasligi kerak";
  if (!payload.subject) return "Fan tanlanishi kerak";
  if (!payload.source) return "Manba tanlanishi kerak";
  if (payload.status === "lost" && !payload.lostReason)
    return "Yo'qotilgan lead sababi yozilishi kerak";

  return null;
}

function buildLeadFilter(query) {
  const filter = {};

  if (query.search) {
    filter.$or = [
      { fullName: { $regex: query.search, $options: "i" } },
      { phone: { $regex: query.search, $options: "i" } },
      { parentName: { $regex: query.search, $options: "i" } },
      { parentPhone: { $regex: query.search, $options: "i" } },
      { source: { $regex: query.search, $options: "i" } },
    ];
  }

  if (query.status) filter.status = query.status;
  if (query.subject) filter.subject = query.subject;
  if (query.source) filter.source = query.source;
  if (query.view === "active") filter.status = { $nin: closedLeadStatuses };
  if (query.view === "closed") filter.status = { $in: closedLeadStatuses };

  return filter;
}

function toUserSummary(user) {
  if (!user) return null;
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    username: user.username,
    role: user.role,
  };
}

function toTeacherSummary(teacher) {
  if (!teacher) return null;
  return {
    id: teacher._id.toString(),
    fullName: teacher.fullName,
    subject: teacher.subject,
    phone: teacher.phone,
  };
}

function toGroupSummary(group) {
  if (!group) return null;
  return {
    id: group._id.toString(),
    name: group.name,
    subject: group.subject,
    teacherId: group.teacherId?._id?.toString() || group.teacherId?.toString(),
    teacher: toTeacherSummary(group.teacherId),
    room: group.room,
    lessonDays: group.lessonDays,
    startTime: group.startTime,
    endTime: group.endTime,
    startDate: group.startDate,
    monthlyPrice: group.monthlyPrice,
    isEnrollmentOpen: group.isEnrollmentOpen !== false,
    status: group.status,
  };
}

function toStudentSummary(student) {
  if (!student) return null;
  return {
    id: student._id.toString(),
    fullName: student.fullName,
    phone: student.phone,
    groupId: student.groupId?.toString(),
    status: student.status,
  };
}

function toLeadResponse(lead) {
  const data = lead.toObject({ virtuals: true });
  const assignedUser =
    data.assignedTo && typeof data.assignedTo === "object"
      ? toUserSummary(data.assignedTo)
      : null;
  const preferredGroup =
    data.preferredGroupId && typeof data.preferredGroupId === "object"
      ? toGroupSummary(data.preferredGroupId)
      : null;
  const trialGroup =
    data.trialGroupId && typeof data.trialGroupId === "object"
      ? toGroupSummary(data.trialGroupId)
      : null;
  const convertedStudent =
    data.convertedStudentId && typeof data.convertedStudentId === "object"
      ? toStudentSummary(data.convertedStudentId)
      : null;

  return {
    ...data,
    id: data._id.toString(),
    assignedTo: assignedUser?.id || data.assignedTo?.toString() || null,
    assignedUser,
    preferredGroupId:
      preferredGroup?.id || data.preferredGroupId?.toString() || null,
    preferredGroup,
    trialGroupId: trialGroup?.id || data.trialGroupId?.toString() || null,
    trialGroup,
    convertedStudentId:
      convertedStudent?.id || data.convertedStudentId?.toString() || null,
    convertedStudent,
    _id: undefined,
    __v: undefined,
  };
}

function populateLead(query) {
  return query
    .populate("assignedTo")
    .populate({ path: "preferredGroupId", populate: { path: "teacherId" } })
    .populate({ path: "trialGroupId", populate: { path: "teacherId" } })
    .populate("convertedStudentId");
}

async function findDuplicateLead(payload, ignoredLeadId) {
  const filter = {
    phone: payload.phone,
    status: { $nin: closedLeadStatuses },
  };

  if (ignoredLeadId) filter._id = { $ne: ignoredLeadId };

  return Lead.findOne(filter);
}

async function findDuplicateStudent(payload) {
  const duplicateChecks = [
    { phone: payload.phone },
    { secondaryPhone: payload.phone },
  ];

  if (payload.secondaryPhone) {
    duplicateChecks.push(
      { phone: payload.secondaryPhone },
      { secondaryPhone: payload.secondaryPhone },
    );
  }

  return Student.findOne({ $or: duplicateChecks });
}

function appendActivity(lead, status, note, user) {
  lead.activityHistory.push({
    status,
    note: note || "",
    createdBy: user?._id || null,
    createdAt: new Date(),
  });
}

export async function getLeads(req, res) {
  try {
    const filter = buildLeadFilter(req.query);
    const { page, limit, skip } = getPagination(req.query);
    const [leads, total] = await Promise.all([
      populateLead(
        Lead.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
      ),
      Lead.countDocuments(filter),
    ]);

    return res.json({
      data: leads.map(toLeadResponse),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return res
      .status(500)
      .json({
        message: "Leadlar ro'yxatini olishda xatolik",
        error: error.message,
      });
  }
}

export async function createLead(req, res) {
  try {
    const payload = normalizeLeadPayload(req.body);
    const requiredError = validateLeadPayload(payload);

    if (requiredError) return res.status(400).json({ message: requiredError });

    if (await findDuplicateLead(payload))
      return res
        .status(409)
        .json({
          message: "Bu telefon raqam bilan faol lead allaqachon mavjud",
        });
    if (await findDuplicateStudent(payload))
      return res
        .status(409)
        .json({ message: "Bu telefon raqam bilan o'quvchi allaqachon mavjud" });

    const lead = await Lead.create({
      ...payload,
      assignedTo: payload.assignedTo || req.user?._id || null,
      activityHistory: [
        {
          status: payload.status,
          note: payload.note || "Lead yaratildi",
          createdBy: req.user?._id || null,
        },
      ],
    });
    const populatedLead = await populateLead(Lead.findById(lead._id));

    return res.status(201).json(toLeadResponse(populatedLead));
  } catch (error) {
    return res
      .status(400)
      .json({ message: "Lead yaratishda xatolik", error: error.message });
  }
}

export async function updateLead(req, res) {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) return res.status(404).json({ message: "Lead topilmadi" });
    if (lead.status === "converted")
      return res
        .status(400)
        .json({ message: "Studentga aylangan leadni o'zgartirib bo'lmaydi" });

    const payload = normalizeLeadPayload(req.body);
    const requiredError = validateLeadPayload(payload);

    if (requiredError) return res.status(400).json({ message: requiredError });
    if (await findDuplicateLead(payload, lead._id))
      return res
        .status(409)
        .json({
          message: "Bu telefon raqam bilan faol lead allaqachon mavjud",
        });

    const previousStatus = lead.status;
    lead.set(payload);

    if (previousStatus !== payload.status)
      appendActivity(
        lead,
        payload.status,
        req.body.activityNote || payload.note,
        req.user,
      );

    await lead.save();
    const populatedLead = await populateLead(Lead.findById(lead._id));

    return res.json(toLeadResponse(populatedLead));
  } catch (error) {
    return res
      .status(400)
      .json({ message: "Leadni yangilashda xatolik", error: error.message });
  }
}

export async function convertLead(req, res) {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) return res.status(404).json({ message: "Lead topilmadi" });
    if (lead.status === "converted" && lead.convertedStudentId)
      return res
        .status(409)
        .json({ message: "Lead allaqachon studentga aylantirilgan" });
    if (!lead.source) {
      return res.status(400).json({ message: "Lead manbasini tanlang" });
    }

    const group = await Group.findById(req.body.groupId);

    if (!group)
      return res.status(400).json({ message: "Tanlangan guruh topilmadi" });
    if (group.status !== "active" || group.isEnrollmentOpen === false)
      return res.status(400).json({ message: "Tanlangan guruhga qabul yopiq" });
    if (await findDuplicateStudent(lead))
      return res
        .status(409)
        .json({ message: "Bu telefon raqam bilan o'quvchi allaqachon mavjud" });

    const now = new Date();
    const discountType = req.body.discountType || "none";
    const discountValue = Number(req.body.discountValue) || 0;
    const discountReason = req.body.discountReason?.trim() || "";
    const student = await Student.create({
      fullName: lead.fullName,
      phone: lead.phone,
      secondaryPhone: lead.secondaryPhone || "",
      parentName: lead.parentName || "",
      parentPhone: lead.parentPhone || "",
      source: lead.source || "",
      groupId: group._id,
      status: "active",
      paymentStatus: "debt",
      note: lead.note || "",
      leftAt: null,
      enrollmentHistory: [
        {
          groupId: group._id,
          groupName: group.name,
          subject: group.subject,
          startedAt: now,
          endedAt: null,
          endReason: "",
        },
      ],
      enrollments: [
        {
          groupId: group._id,
          startedAt: now,
          status: "active",
          discountType,
          discountValue,
          discountReason,
          discountHistory:
            discountType !== "none"
              ? [
                  {
                    type: discountType,
                    value: discountValue,
                    reason: discountReason,
                    startedAt: now,
                  },
                ]
              : [],
        },
      ],
    });

    lead.status = "converted";
    lead.preferredGroupId = group._id;
    lead.convertedStudentId = student._id;
    appendActivity(
      lead,
      "converted",
      req.body.note || "Studentga aylantirildi",
      req.user,
    );
    await lead.save();

    const populatedLead = await populateLead(Lead.findById(lead._id));

    return res.status(201).json(toLeadResponse(populatedLead));
  } catch (error) {
    return res
      .status(400)
      .json({
        message: "Leadni studentga aylantirib bo'lmadi",
        error: error.message,
      });
  }
}

export async function deleteLead(req, res) {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);

    if (!lead) return res.status(404).json({ message: "Lead topilmadi" });

    return res.json({ message: "Lead o'chirildi", id: req.params.id });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Leadni o'chirishda xatolik", error: error.message });
  }
}
