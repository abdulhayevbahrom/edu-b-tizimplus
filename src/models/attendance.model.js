import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: [true, 'Guruh tanlanishi kerak'],
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, "O'quvchi tanlanishi kerak"],
    },
    date: {
      type: Date,
      required: [true, 'Sana tanlanishi kerak'],
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'excused'],
      required: [true, 'Davomat holati tanlanishi kerak'],
    },
    note: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        ret.groupId = ret.groupId?.toString();
        ret.studentId = ret.studentId?.toString();
        ret.markedBy = ret.markedBy?.toString() || null;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

attendanceSchema.index({ groupId: 1, date: 1 });
attendanceSchema.index({ studentId: 1, date: -1 });
attendanceSchema.index({ groupId: 1, studentId: 1, date: 1 }, { unique: true });

export const Attendance = mongoose.model('Attendance', attendanceSchema);
