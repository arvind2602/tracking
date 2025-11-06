const { v2: cloudinary } = require('cloudinary');
const { v4: uuidv4 } = require('uuid');

cloudinary.config({
  cloud_name: "dixp1jeqr",
  api_key: "919413634176236",
  api_secret: "km-UU-YzKExookbkmjOMtQrFqjg",
});


const uploadToCloudinary = async (file, fileType) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: fileType,       // put inside "image" or "video" folder
        public_id: uuidv4(),    // unique name
        resource_type: "auto",  // auto-detect (image, video, etc.)
      },
      (error, result) => {
        if (error) {
          reject(new UnprocessableEntityError(`Failed to upload ${fileType} to Cloudinary: ${error.message}`));
        } else {
          resolve(result.secure_url); // Cloudinary URL
        }
      }
    );

    uploadStream.end(file.buffer);
  });
};

module.exports = { uploadToCloudinary };