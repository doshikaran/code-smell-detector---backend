const express = require("express");
const cors = require("cors");
const bodyParser = require('body-parser');
const app = express();
const auth = require("./routes/auth");
const upload = require("./routes/upload");
const analyze = require("./routes/analyze");

require("dotenv").config();
require("./database.js");

// Middleware
app.use(cors()); 
app.use(bodyParser.json());

// Routes
app.use('/', auth); 
app.use('/', upload);
app.use('/', analyze);

// Server Startx  
const port = process.env.PORT || 8000; 
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
