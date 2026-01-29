import { Schema, model, models } from 'mongoose';

const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'staff'], default: 'staff', index: true },
    isActive: { type: Boolean, default: true },
    status: { 
      type: String, 
      enum: ['active', 'inactive', 'suspended'], 
      default: 'active',
      index: true 
    },
    lastLogin: { type: Date },
    requirePasswordChange: { type: Boolean, default: false },
    lastPasswordReset: { type: Date },
    // Password reset token fields
    resetPasswordToken: { type: String },
    resetPasswordExpiry: { type: Date },
    // Optional profile fields
    avatar: { type: String },
    phone: { type: String },
    department: { type: String },
    position: { type: String },
    jobTitle: { type: String },
    joinDate: { type: String },
    bio: { type: String },
    company: { type: String },
  },
  { timestamps: true }
);

const User = models.User || model('User', UserSchema);

export default User;


