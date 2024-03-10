const express = require("express");
const multer = require("multer");
const path = require("path");

const router = express.Router();
const storage = multer.diskStorage({
  destination: (request, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (request, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const fileFilter = (request, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.js' && ext !== '.py') {
    cb(new Error('Only .js files are allowed'), false);
  } else {
    cb(null, true);
  }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

router.post('/upload', upload.single('file'), (request, response) => {
  if (!request.file) {
    return response.status(400).send('No file uploaded or invalid file type.');
  }
  response.json({ message: 'File uploaded successfully!', filePath: request.file.path });
});

module.exports = router;
