import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { authRouter } from './routes/auth.js';
import { habitsRouter } from './routes/habits.js';
import { calendarRouter } from './routes/calendar.js';
import { statsRouter } from './routes/stats.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
}));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/habits', habitsRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/stats', statsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

