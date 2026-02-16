const { v2: cloudinary } = require('cloudinary');
const { UnprocessableEntityError } = require('../utils/errors');

/**
 * Configures Cloudinary using environment variables.
 * Credentials MUST NOT be hardcoded — they are loaded from process.env.
 * @see .env.example for required variable names.
 */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

if (!process.env.CLOUDINARY_API_SECRET) {
  console.warn('WARNING: CLOUDINARY_API_SECRET is not set. Image uploads will fail.');
}

/**
 * Uploads a file buffer to Cloudinary and returns the secure URL.
 * @param {Object} file - Multer file object with a `.buffer` property
 * @param {string} fileType - Folder name in Cloudinary (e.g., 'image', 'video')
 * @returns {Promise<string>} The secure URL of the uploaded asset
 * @throws {UnprocessableEntityError} If the upload fails
 */
const uploadToCloudinary = async (file, fileType) => {
  const { v4: uuidv4 } = await import('uuid');
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: fileType,
        public_id: uuidv4(),
        resource_type: "auto",
      },
      (error, result) => {
        if (error) {
          reject(new UnprocessableEntityError(`Failed to upload ${fileType} to Cloudinary: ${error.message}`));
        } else {
          resolve(result.secure_url);
        }
      }
    );

    uploadStream.end(file.buffer);
  });
};

module.exports = { uploadToCloudinary };