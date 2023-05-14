const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const sendEmail = require('./../utils/email');
const resetPasswordRoute = 'api/v1/users/resetPassword';

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
  });

  const token = signToken(newUser._id);

  res.status(201).json({
    status: 'success',
    token,
    data: {
      user: newUser,
    },
  });
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = await req.body;

  // 1) Check if email & password exist.
  if (!email || !password)
    return next(new AppError('Please provide email and password!', 400)); // 400 stands for bad request.

  // 2) Check if user exists & password is correct.
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password)))
    return next(new AppError('Incorrect email or password!', 401));

  // 3) If everything ok, send token to client.
  const token = signToken(user._id);
  res.status(200).json({
    status: 'success',
    token,
  });

  const correct = await user.correctPassword(password, user.password);
});

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it's exist.
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token)
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401)
    );

  // 2) Verification token.
  const decodeded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  // console.log(decodeded);

  // 3) Check if user still exists.
  const freshUser = await User.findById(decodeded.id);
  if (!freshUser)
    return next(
      new AppError(
        'The user belonging to this token does no longer exist.',
        401
      )
    );

  // 4) check if user changed password after the token was issued.
  if (freshUser.changedPasswordAfter(decodeded.iat)) {
    // iat(issued at).
    return next(
      new AppError('User recently changed password, Please log in again.', 401)
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE.
  req.user = freshUser;
  next();
});

exports.restrictTo = (...role) => {
  // role = ['admin', 'lead-guide']
  return (req, res, next) => {
    if (!role.includes(req.user.role))
      return next(
        new AppError('You do not have permission to perform this action!', 403) // 403 means forbidden.
      );

    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email.
  const user = await User.findOne({ email: req.body.email });
  if (!user)
    return next(new AppError('There is no user with email address!', 404));

  // 2) Generate the random reset token.
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's E-mail.
  const resetURL = `${req.protocol}://${req.get(
    'host'
  )}/${resetPasswordRoute}/${resetToken}`;

  const message = `Forgot your password? Submit a PATCH request with your new password and password confirm to: ${resetURL}.\nIf you didn't forgot your password, please ignore this email.`;

  try {
    // We are using "try & catch" to handle any error caused by "sendEmail".
    await sendEmail({
      email: user.email,
      subject: 'Your password reset token (Valid For 10 min.',
      message,
    });

    res.status(200).json({
      status: 'Success',
      message: 'Token sent to email!',
    });
  } catch (err) {
    console.log(err);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError('There was an error sending email. Try again later!'),
      500
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on token.
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // 2) If the token has not expired, and there is a user, set the new password.
  if (!user) return next(new AppError('Token is invalid or expired!', 400));

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // 3) Update changedPasswordAt property.
  // There is a pre MW doing it automatically.

  // 4) Log the user in, send JWT.
  const token = signToken(user._id);

  res.status(200).json({
    status: 'Success',
    token,
  });
});
