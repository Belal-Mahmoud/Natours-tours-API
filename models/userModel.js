const crypto = require('crypto'); // It is built-in a node module.
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please tell us your name!'],
  },
  email: {
    type: String,
    required: [true, 'Please provide your email!'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email.'],
  },
  photo: {
    type: String,
  },
  role: {
    type: String,
    enum: ['user', 'guide', 'lead-guide', 'admin'],
    default: 'user',
  },
  password: {
    type: String,
    required: [true, 'Please provide a password!'],
    minlength: [8, 'Your password have to be more than 8 characters!'],
    select: false, // To not show it as an output.
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password!'],
    validate: {
      // This only works on CREATE & SAVE!
      validator: function (el) {
        return el === this.password;
      },
      message: 'Passwords are not the same!',
    },
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
});

// Encryption, we are writting it here as 'DOCUMENT MIDDLEWARE' because it going to happen after receive data and before send it to the DB.
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  // We need to do this while modifing the 'password', so we check if the 'password' is changed or not because we don't want to use it if we have modified the 'email' for example.

  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = undefined; // We want to delete it because we don't need it any more, and remember it's required as an input not to persist to the DB.
  next();
});

userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000; // The (-1000) is a hack to avoid the problem that happen when the new token generated before saving this value.
  next();
});

userSchema.pre(/^find/, function (next) {
  this.find({ active: { $ne: false } });

  next();
});

// Instance method: which is gonna be available on all documents of a certain collection.
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  // We are passing "user password" while this function has access to the current document because we set password's "select" as "false".
  return await bcrypt.compare(candidatePassword, userPassword); // Returns true if they are the same & otherwise returns false.
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10 // The base number.
    ); // To convert anytime standard to timestamp.

    return JWTTimestamp < changedTimestamp;
  }

  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex'); // Generates 32characters and converted to hexadecimal.

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex'); // Used crypto to encypt "resetToken" using hash method using 'sha256' protocol and converted to hexadecimal.

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // After 10mins in milli seconds from creating it.

  return resetToken; // To send it through the email.
};

const User = mongoose.model('User', userSchema);

module.exports = User;
