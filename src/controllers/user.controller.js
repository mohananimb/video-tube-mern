import mongoose from "mongoose";
import { cookieOptions, validationRegex } from "../constants.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  destroyCloudinaryImage,
  uploadonCloudinary,
} from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";

const getRefreshAndAccessToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating access or refresh token."
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
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // set cookie and return response
  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  // is user logged in this will done from auth middleware
  await User.findByIdAndUpdate(req.user._id, {
    $unset: {
      refreshToken: 1, // this removes the field from document
    },
  });

  //remove cookies
  return res
    .status(200)
    .clearCookie("refreshToken", cookieOptions)
    .clearCookie("accessToken", cookieOptions)
    .json(new ApiResponse(200, {}, "User logged out."));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const { accessToken, newRefreshToken } = await getRefreshAndAccessToken(
      user._id
    );

    return res
      .status(200)
      .cookie("accessToken", accessToken, cookieOptions)
      .cookie("refreshToken", newRefreshToken, cookieOptions)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  // get the data from body
  const { oldPassword, newPassword } = req.body;

  // validate the data
  if (!oldPassword && newPassword) {
    throw new ApiError(400, "Please provide the old password and new password");
  }

  // compare the old password with DB
  const user = await User.findById(req.user?._id);

  const isCorrectPassword = await user.isPasswordCorrect(oldPassword);

  if (!isCorrectPassword) {
    throw new ApiError(400, "Incorrect password provided");
  }

  // update the new password
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  // return the res
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password updated successfully."));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User fetched successfully."));
});

const updateUserDetails = asyncHandler(async (req, res) => {
  // get the details from body
  const { fullName, email } = req.body;

  // validated the details
  if (!(fullName || email)) {
    throw new ApiError(
      400,
      "Please provide email or fullName to update the details."
    );
  }

  // find user and update the details
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        email,
        fullName,
      },
    },
    { new: true }
  ).select("-password");

  // return the res
  return res
    .status(200)
    .json(new ApiResponse(200, user, "User updated successfully."));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  // get the avatar file
  const avatarLocalPath = req.file?.path;

  // validate file
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required.");
  }

  // upload to cloudinary
  const avatar = await uploadonCloudinary(avatarLocalPath);
  if (!avatar) {
    throw new ApiError(500, "Failed to upload the file, please try again");
  }

  req.user.avatar && (await destroyCloudinaryImage(req.user.avatar));

  // save the url in the DB
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  //return the res
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated successfully."));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  // get the avatar file
  const coverImageLocalPath = req.file?.path;

  // validate file
  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover Image file is required.");
  }

  // upload to cloudinary
  const coverImage = await uploadonCloudinary(coverImageLocalPath);

  if (!coverImage) {
    throw new ApiError(500, "Failed to upload the file, please try again");
  }

  // TODO - delete an existing image from cloudinary.
  req.user.coverImage && (await destroyCloudinaryImage(req.user.coverImage));

  // save the url in the DB
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  //return the res
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image updated successfully."));
});

const getChannelDetails = asyncHandler(async (req, res) => {
  // get the username from params
  const { username } = req.params;

  if (!username) {
    throw new ApiError(400, "Please provide username.");
  }

  const channel = await User.aggregate([
    // 1st pipeline to find the matched user with given username
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },

    // 2nd pipeline to find subscribers of this user (channel)
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
        // pipeline: [
        //   {
        //     $lookup: {
        //       from: "users",
        //       foreignField: "_id",
        //       localField: "channel",
        //       as: "subscriber",
        //       pipeline: [
        //         {
        //           $project: {
        //             fullName: 1,
        //             username: 1,
        //           },
        //         },
        //       ],
        //     },
        //   },
        // ],
      },
    },

    // 3rd pipeline to find the to which this user has subscribed to
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        subscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        subscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
        // we can add subscribers and subscibe to details as well
        // subscribers: 1,
        // subscribedTo: 1,
      },
    },
  ]);

  if (!channel.length) {
    throw new ApiError(400, "Channel does not exist with given username");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, channel, "Channel fetched successfully."));
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user?._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch History fetch successfully."
      )
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateUserDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getChannelDetails,
  getWatchHistory,
};
