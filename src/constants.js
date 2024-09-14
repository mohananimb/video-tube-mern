export const DB_NAME = "video_tube_mern";
export const validationRegex = {
  password:
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
};

export const cookieOptions = {
  httpOnly: true,
  secure: true,
};
