import 'dotenv/config';
import app from './app';

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`🚀 API Server running smoothly on http://localhost:${port}`);
  console.log(`🩺 Health check available at http://localhost:${port}/health`);
});
