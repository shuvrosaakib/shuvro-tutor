require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const conversationRoutes = require('./routes/conversation');
const progressRoutes = require('./routes/progress');
const geminiService = require('./services/gemini-service');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Initialize database
db.init().catch(err => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/conversation', conversationRoutes);
app.use('/api/progress', progressRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket connection for voice streaming
wss.on('connection', (ws, req) => {
  console.log('WebSocket client connected');
  
  let geminiSession = null;
  let userId = null;
  let sessionId = null;

  ws.on('message', async (data) => {
    try {
      if (typeof data === 'string') {
        const message = JSON.parse(data);
        
        if (message.type === 'init') {
          // Initialize Gemini Live session
          userId = message.userId;
          sessionId = message.sessionId;
          const mode = message.mode || 'free-conversation';
          const character = message.character || 'friendly-tutor';
          const learnerMemory = message.learnerMemory || {};

          geminiSession = await geminiService.initializeSession(
            userId,
            sessionId,
            mode,
            character,
            learnerMemory
          );

          ws.send(JSON.stringify({
            type: 'session-ready',
            sessionId: sessionId,
            message: 'Gemini Live session initialized'
          }));

        } else if (message.type === 'transcript') {
          // Save conversation turn to database
          if (userId && sessionId) {
            await db.saveConversationTurn(
              sessionId,
              message.speaker,
              message.text,
              message.timestamp
            );
          }
          
          ws.send(JSON.stringify({
            type: 'transcript-saved',
            turnId: message.turnId
          }));

        } else if (message.type === 'end-session') {
          // End session and cleanup
          if (geminiSession) {
            await geminiService.endSession(geminiSession);
          }
          
          // Save session summary
          if (userId && sessionId) {
            await db.saveSessionSummary(
              sessionId,
              message.duration,
              message.turnCount,
              message.performance
            );
          }

          ws.send(JSON.stringify({
            type: 'session-ended',
            message: 'Session saved and closed'
          }));
        }
      } else if (data instanceof ArrayBuffer) {
        // Audio data from client - forward to Gemini Live
        if (geminiSession) {
          const audioResponse = await geminiService.sendAudio(geminiSession, data);
          if (audioResponse) {
            ws.send(audioResponse);
          }
        }
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
      ws.send(JSON.stringify({
        type: 'error',
        message: err.message
      }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    if (geminiSession) {
      geminiService.endSession(geminiSession);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Shuvro Tutor server running on http://localhost:${PORT}`);
});
