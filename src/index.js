// require("dotenv").config({ path: "./.env" });
// import mongoose from "mongoose";
// import { DB_NAME } from "./constants";
// import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./db/index.js";
import { app } from "./app.js";

dotenv.config({
  path: "./.env",
});

connectDB()
  .then(() => {
    const PORT = process.env.PORT;
    app.listen(PORT || 8000, () => {
      console.log(`Server is running at port: ${PORT}`);
    });
  })
  .catch((err) => {
    console.log("MONGO DB connection failed !! ", err);
  });

/* const app = express();
(async () => {
  try {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);

    app.on("error", (error) => {
      console.error("ERROR:", error);
      throw error;
    });

    app.listen(process.env.PORT, () => {
      console.log(`App is listening on por ${process.env.PORT}`);
    });
  } catch (error) {
    console.error("ERROR:", error);
  }
})();

*/
