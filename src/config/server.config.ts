import dotenv from 'dotenv';
dotenv.config();

export const PORT = process.env.PORT || 3000;
export const logger_level = process.env.logger_level || 'debug';
