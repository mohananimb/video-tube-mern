import { cookieOptions, validationRegex } from "../constants.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadonCloudinary } from "../utils/cloudinary.js";

const getRefreshAndAccessToken = async (userId) => {
  // generateAccessToken;
  // generateRefreshToken;
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating access or refresh token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // get user details
  const { username, email, fullName, password } = req.body;
  // validation for user input, it should not be empty
  const isEmptyField = [username, email, fullName, password].some(
    (field) => !field
  );

  if (isEmptyField) {
    throw new ApiError(400, "All fields are required.");
  }

  const isValidPassword = validationRegex.password.test(password);
  if (!isValidPassword) {
    throw new ApiError(
      400,
      "Password should be at least eight charactes long and contain at least one uppercase, one lower case, one special character and at least one number."
    );
  }
  // check user already exist or not, if exists throw error
  const isUserExist = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (isUserExist) {
    throw new ApiError(409, "User with this email or username already exists.");
  }

  // check for images like avatar and cover image
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required.");
  }

  // upload them to cloudinary
  const avatar = await uploadonCloudinary(avatarLocalPath);
  const coverImage = await uploadonCloudinary(coverImageLocalPath);
  if (!avatar) {
    throw new ApiError(400, "Avatar file is required.");
  }
  // create a user object and save it in the DB
  const user = await User.create({
    fullName,
    email,
    username: username.toLowerCase(),
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    password,
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  // check for user creation and return the user without password and token
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered Successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  // take inputs ---> req.body
  const { username, email, password } = req.body;

  // validate the inputs
  if (!(username || email)) {
    throw new ApiError(400, "username or email is required to login");
  }

  // find user if exist or not
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User not found with given email or username");
  }

  // check password is correct
  const isCorrectPassword = await user.isPasswordCorrect(password);
  if (!isCorrectPassword) {
    throw new ApiError(400, "Incorrect Password");
  }

  // set refresh and access token
  const { accessToken, refreshToken } = await getRefreshAndAccessToken(
    user._id
  );
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  // set cookie and return response
  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        { user, accessToken, refreshToken },
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  // is user logged in this will done from auth middleware
  await User.findByIdAndDelete(
    req.user._id,
    {
      $unset: {
        refreshToken: 1, // this removes the field from document
      },
    },
  );

  //remove cookies
  return res
    .status(200)
    .clearCookie("refresh-token", cookieOptions)
    .clearCookie("access-token", cookieOptions)
    .json(new ApiResponse(200, {}, "User logged out."));
});

export { registerUser, loginUser, logoutUser };
