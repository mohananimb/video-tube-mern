import mongoose from "mongoose";
import { Subscription } from "../models/subscription.model.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const subscribeChannel = asyncHandler(async (req, res) => {
  const { subscribeTo } = req.params; // subscribeTo is channel (User) ID

  if (!subscribeTo) {
    throw new ApiError(400, "Provide channel to subscribe");
  }

  const isChannelExist = await User.findById(subscribeTo);

  if (!isChannelExist) {
    throw new ApiError(400, "Channel does not exists.");
  }

  const isAlreadySubscribed = await Subscription.findOne({
    $and: [{ subscriber: req.user?._id }, { channel: subscribeTo }],
  });

  if (isAlreadySubscribed) {
    throw new ApiError(400, "Channel is already subscribed.");
  }

  await Subscription.create({
    subscriber: req.user?._id,
    channel: subscribeTo,
  });

  const subscribtion = await Subscription.aggregate([
    {
      $match: {
        subscriber: new mongoose.Types.ObjectId(req.user?._id),
        channel: new mongoose.Types.ObjectId(subscribeTo),
      },
    },
    {
      $lookup: {
        from: "users",
        foreignField: "_id",
        localField: "subscriber",
        as: "subscriber",
        pipeline: [
          {
            $project: {
              username: 1,
              email: 1,
              fullName: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "users",
        foreignField: "_id",
        localField: "channel",
        as: "subscribedTo",
        pipeline: [
          {
            $project: {
              username: 1,
              email: 1,
              fullName: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        subscriber: {
          $first: "$subscriber",
        },
        subscribedTo: {
          $first: "$subscribedTo",
        },
      },
    },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, subscribtion[0], "Subscribe successfully."));
});

const unsubscribeChannel = asyncHandler(async (req, res) => {
  const { unsubscribeTo } = req.params;

  if (!unsubscribeTo) {
    throw new ApiError(400, "Provide channel to unsubscribe");
  }

  const isChannelExist = await User.findById(unsubscribeTo);

  if (!isChannelExist) {
    throw new ApiError(400, "Channel does not exists.");
  }

  const isSubscribed = await Subscription.findOne({
    $and: [{ subscriber: req.user?._id }, { channel: unsubscribeTo }],
  });

  if (!isSubscribed) {
    throw new ApiError(400, "Subscribe the channel first to unsubscribe it.");
  }

  await Subscription.findByIdAndDelete(isSubscribed._id);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Unsubscribed successfully."));
});

export { subscribeChannel, unsubscribeChannel };
  
