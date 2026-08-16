import { Pool } from 'pg';
import config from '../config/env';

export const pool = new Pool({ connectionString: config.db.postgresUrl });
