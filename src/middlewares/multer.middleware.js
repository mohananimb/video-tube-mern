import multer from "multer";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/temp");
  },
  filename: function (req, file, cb) {
    // orignal name is bad pracitce
    cb(null, file.originalname);
  },
});

export const upload = multer({ storage });
