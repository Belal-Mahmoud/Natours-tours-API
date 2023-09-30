const crypto = require('crypto');
const { promisify } = require('util'); // Using "promisify" from "util" to make a function return promise.
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

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    //secure: true, // The cookie will be sent only on an encrypted connection, Only using HTTPS.
    httpOnly: true, // The cookie can't be accessed or modified in any way by the browser, so the browser will only store the cookie and then send it automatically along with every request.
  };
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);

  // Remove password from output.
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
  });

  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = await req.body;

  // 1) Check if email & password exist.
  if (!email || !password)
    return next(new AppError('Please provide email and password!', 400)); // 400 stands for bad request.

  // 2) Check if user exists & password is correct.
  const user = await User.findOne({ email }).select('+password'); // Here we are finding user according to his "email", and adding "password" using "+" before it because we set its "select" as "false" in the "userSchema".

  if (!user || !(await user.correctPassword(password, user.password)))
    return next(new AppError('Incorrect email or password!', 401)); // 401 stands for unauthorized, and here we are able to check (tour & password) separatly but it will give a potential attacker information whether the email or the password is incorrect.

  // 3) If everything ok, send token to client.
  createSendToken(user, 200, res);
});

exports.logout = (req, res) => {
  res.cookie('jwt', 'Loggedout', {
    expires: new Date.now + 10 * 1000, // To expire after 10seconds.
    httpOnly: true
  });
  res.status(200).json({status: 'seccess'});
};

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it's exist.
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt
  }

  if (!token)
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401)
    );

  // 2) Verification token.
  const decodeded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists.
  const currentUser = await User.findById(decodeded.id);
  if (!currentUser)
    return next(
      new AppError(
        'The user belonging to this token does no longer exist.',
        401
      )
    );
  // console.log(currentUser, currentUser.id);

  // 4) check if user changed password after the token was issued.
  if (currentUser.changedPasswordAfter(decodeded.iat)) {
    // iat(issued at).
    return next(
      new AppError('User recently changed password, Please log in again.', 401)
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE.
  req.user = currentUser; // To put the user data on a request.
  req.locals.user = currentUser;
  next();
});

// Only for rendered pages, no errors!
exports.isLoggedIn = async (req, res, next) => {
 if (req.cookies.jwt) {
  try{
    // 1) Verify Token.
    const decodeded = await promisify(jwt.verify)(req.cookies.jwt /* The Token */, process.env.JWT_SECRET);
    // console.log(decodeded);

    // 2) Check if user still exists.
    const currentUser = await User.findById(decodeded.id);
    if (!currentUser)
      return next();
    // console.log(currentUser, currentUser.id);

    // 3) check if current user changed password after the token was issued.
    if (currentUser.changedPasswordAfter(decodeded.iat)) {
      // iat(issued at).
      return next();
    }

    // There Is A LOGGED IN User.
    req.locals.user = currentUser; // Using "Locals" to access this user in our template (PUG).
    return next();
  } catch(err) {
    return next();
  }
}
  next();
};

exports.restrictTo = (...role) => {
  // role = ['admin', 'lead-guide']
  return (req, res, next) => {
    if (!role.includes(req.user.role))
      return next(
        new AppError('You do not have permission to perform this action!', 403)
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
  await user.save({ validateBeforeSave: false }); // Used to save the new token and its expire date that generated from this function "createPasswordResetToken()" and have set it 'validateBeforeSave: false' to not run any validator.

  // 3) Send it to user's E-mail.
  const resetURL = `${req.protocol}://${req.get(
    'host'
  )}/${resetPasswordRoute}/${resetToken}`;

  const message = `Forgot your password? Submit a PATCH request with your new password and password confirm to: ${resetURL}.\nIf you didn't forgot your password, please ignore this email.`;

  try {
    // We are using "try & catch" to handle any error using "sendEmail".
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
  // There is a pre MW doing it automatically in "userModel".

  // 4) Log the user in, send JWT.
  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection.
  const user = await User.findById(req.user.id).select('+password');

  // 2) Check if POSTed current password is correct.
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password)))
    return next(new AppError('Your current password is wrong.'), 401);

  // 3) If so, update password.
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  // User.findByIdAndUpdate will NOT work as intended!

  // 4) log user in, seng JWT.
  createSendToken(user, 200, res);
});
