import mongoose from 'mongoose';

const roomSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: 'rooms', immutable: true },
    rooms: {
      type: [String],
      default: [],
      set: (rooms) => Array.from(new Set((rooms || []).map((room) => room.trim()).filter(Boolean))),
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret._id;
        delete ret.__v;
        delete ret.key;
        return ret;
      },
    },
  },
);

export const RoomSettings = mongoose.model('RoomSettings', roomSettingsSchema);
