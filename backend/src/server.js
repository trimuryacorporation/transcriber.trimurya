import 'dotenv/config';
import { app } from './app.js';
import { connectDatabase } from './config/db.js';

const port = process.env.PORT || 5000;

connectDatabase().then(() => {
  app.listen(port, () => {
    console.log(`Trimurya Transcriber API running on port ${port}`);
  });
});
