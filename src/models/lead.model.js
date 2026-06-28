import mongoose from 'mongoose';

const leadStatuses = ['new', 'contacted', 'interested', 'trial_scheduled', 'trial_attended', 'ready_to_enroll', 'converted', 'lost'];

const leadActivitySchema = new mongoose.Schema(
  {
    status: { type: String, enum: leadStatuses, required: true },
    note: { type: String, trim: true, maxlength: 500, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const leadSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Lead F.I.Sh kiritilishi kerak'],
      trim: true,
      minlength: 3,
      maxlength: 120,
    },
    phone: {
      type: String,
      required: [true, 'Telefon raqam kiritilishi kerak'],
      trim: true,
      maxlength: 32,
    },
    secondaryPhone: { type: String, trim: true, maxlength: 32, default: '' },
    parentName: { type: String, trim: true, maxlength: 120, default: '' },
    parentPhone: { type: String, trim: true, maxlength: 32, default: '' },
    subject: {
      type: String,
      required: [true, 'Fan tanlanishi kerak'],
      trim: true,
      maxlength: 80,
    },
    source: {
      type: String,
      required: [true, 'Manba tanlanishi kerak'],
      trim: true,
      maxlength: 80,
    },
    status: { type: String, enum: leadStatuses, default: 'new' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    preferredGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
    trialGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
    trialDate: { type: Date, default: null },
    nextContactAt: { type: Date, default: null },
    lostReason: { type: String, trim: true, maxlength: 300, default: '' },
    convertedStudentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
    note: { type: String, trim: true, maxlength: 500, default: '' },
    activityHistory: { type: [leadActivitySchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        ret.assignedTo = ret.assignedTo?.toString() || null;
        ret.preferredGroupId = ret.preferredGroupId?.toString() || null;
        ret.trialGroupId = ret.trialGroupId?.toString() || null;
        ret.convertedStudentId = ret.convertedStudentId?.toString() || null;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

leadSchema.index({ phone: 1 });
leadSchema.index({ status: 1, createdAt: -1 });
leadSchema.index({ subject: 1 });
leadSchema.index({ nextContactAt: 1 });

export const Lead = mongoose.model('Lead', leadSchema);
