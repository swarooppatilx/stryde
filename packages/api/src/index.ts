import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { activities } from './routes/activities';
import { health } from './routes/health';
import { ipfs } from './routes/ipfs';
import { notifications } from './routes/notifications';

const app = new Hono().basePath('/api');

app.use('*', logger());
app.use('*', cors());

app.route('/health', health);
app.route('/activities', activities);
app.route('/ipfs', ipfs);
app.route('/notifications', notifications);

export default app;
