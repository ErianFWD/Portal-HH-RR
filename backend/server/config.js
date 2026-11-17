import dotenv from 'dotenv';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
dotenv.config({path:fileURLToPath(new URL('../.env', import.meta.url))});
export const config=z.object({DATABASE_URL:z.string().url(),PORT:z.coerce.number().int().min(1).max(65535).default(3000),NODE_ENV:z.enum(['development','test','production']).default('development'),DEMO_PASSWORD:z.string().optional(),DEEPSEEK_API_KEY:z.string().optional(),DEEPSEEK_MODEL:z.string().min(1).default('deepseek-flash'),VOYAGE_API_KEY:z.string().optional(),VOYAGE_MODEL:z.string().default('voyage-multilingual-2'),GOOGLE_APPLICATION_CREDENTIALS:z.string().optional(),DRIVE_FILE_ID:z.string().optional()}).parse(process.env);
