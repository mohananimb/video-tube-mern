import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadonCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    //upload file on cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    // file uplaoded successfully
    console.log("File is uploaded on cloudinary.", response.url);
    fs.unlinkSync(localFilePath);
    return response;
  } catch (error) {
    fs.unlinkSync(localFilePath); // remove the locally saved temp file as upload has been failed
    return null;
  }
};

const getPublicId = (imageURL) => imageURL.split("/").pop().split(".")[0];

const destroyCloudinaryImage = async (imageUrl) => {
  try {
    if (!imageUrl) return null;
    const publicId = getPublicId(imageUrl);
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    return null;
  }
};

export { uploadonCloudinary, destroyCloudinaryImage };
