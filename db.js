const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_URL?.replace('sqlite://', '') || './shuvro_tutor.db';
const uploadDir = process.env.UPLOAD_DIR || './uploads';

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

let db = null;

const Database = {
  init: async () => {
    return new Promise((resolve, reject) => {
      db = new sqlite3.Database(dbPath, async (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          await Database.createTables();
          resolve();
        }
      });
    });
  },

  createTables: async () => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // Users table
        db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT,
            bio TEXT,
            native_language TEXT,
            profile_picture TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Learning profiles
        db.run(`
          CREATE TABLE IF NOT EXISTS learning_profiles (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            target_ielts_band INTEGER,
            exam_date TEXT,
            daily_practice_target INTEGER,
            estimated_cefr TEXT DEFAULT 'NOT_ASSESSED',
            estimated_ielts_band REAL,
            total_sessions INTEGER DEFAULT 0,
            total_speaking_time INTEGER DEFAULT 0,
            total_turns INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
          )
        `);

        // Conversation sessions
        db.run(`
          CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            mode TEXT NOT NULL,
            character TEXT NOT NULL,
            topic TEXT,
            start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            end_time DATETIME,
            duration INTEGER,
            turn_count INTEGER DEFAULT 0,
            performance_score REAL,
            summary TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
          )
        `);

        // Conversation turns (transcripts)
        db.run(`
          CREATE TABLE IF NOT EXISTS conversation_turns (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            speaker TEXT NOT NULL,
            text TEXT NOT NULL,
            turn_index INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(session_id) REFERENCES sessions(id)
          )
        `);

        // Corrections
        db.run(`
          CREATE TABLE IF NOT EXISTS corrections (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            turn_id TEXT,
            user_id TEXT NOT NULL,
            original_text TEXT,
            corrected_text TEXT,
            explanation TEXT,
            grammar_category TEXT,
            recurrence_count INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(session_id) REFERENCES sessions(id),
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(turn_id) REFERENCES conversation_turns(id)
          )
        `);

        // Vocabulary
        db.run(`
          CREATE TABLE IF NOT EXISTS vocabulary (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            word TEXT NOT NULL,
            definition TEXT,
            example_sentence TEXT,
            category TEXT,
            mastered BOOLEAN DEFAULT 0,
            review_count INTEGER DEFAULT 0,
            last_reviewed DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
          )
        `);

        // Progress snapshots
        db.run(`
          CREATE TABLE IF NOT EXISTS progress_snapshots (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            session_id TEXT,
            fluency_score REAL,
            grammar_score REAL,
            vocabulary_score REAL,
            pronunciation_score REAL,
            confidence_score REAL,
            estimated_cefr TEXT,
            estimated_ielts_band REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(session_id) REFERENCES sessions(id)
          )
        `);

        // Learner memory (accumulated learning data)
        db.run(`
          CREATE TABLE IF NOT EXISTS learner_memory (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            memory_type TEXT NOT NULL,
            data TEXT NOT NULL,
            confidence REAL DEFAULT 0.5,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
          )
        `);

        // Topic history
        db.run(`
          CREATE TABLE IF NOT EXISTS topic_history (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            topic TEXT NOT NULL,
            mode TEXT,
            practiced_count INTEGER DEFAULT 0,
            performance_score REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
          )
        `);

        // Learning tracks
        db.run(`
          CREATE TABLE IF NOT EXISTS learning_tracks (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            track_name TEXT NOT NULL,
            current_level TEXT,
            target_level TEXT,
            progress REAL DEFAULT 0,
            sequence TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
          )
        `);

        // Recommendations
        db.run(`
          CREATE TABLE IF NOT EXISTS recommendations (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            topic TEXT NOT NULL,
            reason TEXT,
            target_skill TEXT,
            priority INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS mock_tests (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            test_type TEXT,
            start_time DATETIME,
            end_time DATETIME,
            duration INTEGER,
            part1_score REAL,
            part2_score REAL,
            part3_score REAL,
            overall_score REAL,
            feedback TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
          )
        `, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    });
  },

  // User methods
  createUser: (id, email, hashedPassword, name = '') => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?)`,
        [id, email, hashedPassword, name],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },

  getUserByEmail: (email) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM users WHERE email = ?`,
        [email],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  },

  getUserById: (id) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM users WHERE id = ?`,
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  },

  updateUser: (id, updates) => {
    return new Promise((resolve, reject) => {
      const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      const values = [...Object.values(updates), id];
      
      db.run(
        `UPDATE users SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },

  // Learning profile methods
  createLearningProfile: (id, userId) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO learning_profiles (id, user_id) VALUES (?, ?)`,
        [id, userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },

  getLearningProfile: (userId) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM learning_profiles WHERE user_id = ?`,
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  },

  updateLearningProfile: (userId, updates) => {
    return new Promise((resolve, reject) => {
      const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      const values = [...Object.values(updates), userId];
      
      db.run(
        `UPDATE learning_profiles SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
        values,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },

  // Session methods
  createSession: (id, userId, mode, character, topic) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO sessions (id, user_id, mode, character, topic) VALUES (?, ?, ?, ?, ?)`,
        [id, userId, mode, character, topic],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },

  getSession: (sessionId) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM sessions WHERE id = ?`,
        [sessionId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  },

  getUserSessions: (userId, limit = 50) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
        [userId, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  },

  endSession: (sessionId, duration, turnCount, performanceScore) => {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE sessions SET end_time = CURRENT_TIMESTAMP, duration = ?, turn_count = ?, performance_score = ? WHERE id = ?`,
        [duration, turnCount, performanceScore, sessionId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },

  deleteSession: (sessionId) => {
    return new Promise((resolve, reject) => {
      // Delete related turns first
      db.run(
        `DELETE FROM conversation_turns WHERE session_id = ?`,
        [sessionId],
        (err) => {
          if (err) {
            reject(err);
          } else {
            // Delete session
            db.run(
              `DELETE FROM sessions WHERE id = ?`,
              [sessionId],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          }
        }
      );
    });
  },

  // Conversation turn methods
  saveConversationTurn: (sessionId, speaker, text, timestamp) => {
    return new Promise((resolve, reject) => {
      const { v4: uuidv4 } = require('uuid');
      const turnId = uuidv4();
      
      db.run(
        `INSERT INTO conversation_turns (id, session_id, speaker, text, timestamp) VALUES (?, ?, ?, ?, ?)`,
        [turnId, sessionId, speaker, text, timestamp || new Date().toISOString()],
        (err) => {
          if (err) reject(err);
          else resolve(turnId);
        }
      );
    });
  },

  getSessionTranscript: (sessionId) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM conversation_turns WHERE session_id = ? ORDER BY timestamp ASC`,
        [sessionId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  },

  // Correction methods
  saveCorrection: (sessionId, turnId, userId, original, corrected, explanation, category) => {
    return new Promise((resolve, reject) => {
      const { v4: uuidv4 } = require('uuid');
      const correctionId = uuidv4();
      
      db.run(
        `INSERT INTO corrections (id, session_id, turn_id, user_id, original_text, corrected_text, explanation, grammar_category) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [correctionId, sessionId, turnId, userId, original, corrected, explanation, category],
        (err) => {
          if (err) reject(err);
          else resolve(correctionId);
        }
      );
    });
  },

  getUserCorrections: (userId, limit = 100) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM corrections WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
        [userId, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  },

  // Progress methods
  saveProgressSnapshot: (id, userId, sessionId, scores) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO progress_snapshots (id, user_id, session_id, fluency_score, grammar_score, vocabulary_score, pronunciation_score, confidence_score, estimated_cefr, estimated_ielts_band)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          userId,
          sessionId,
          scores.fluency || 0,
          scores.grammar || 0,
          scores.vocabulary || 0,
          scores.pronunciation || 0,
          scores.confidence || 0,
          scores.estimated_cefr || 'NOT_ASSESSED',
          scores.estimated_ielts_band || null
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },

  getUserProgress: (userId) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM progress_snapshots WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  },

  // Learner memory methods
  saveLearnerMemory: (id, userId, memoryType, data, confidence = 0.5) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO learner_memory (id, user_id, memory_type, data, confidence) VALUES (?, ?, ?, ?, ?)`,
        [id, userId, memoryType, data, confidence],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },

  getLearnerMemory: (userId, memoryType = null) => {
    return new Promise((resolve, reject) => {
      let query = `SELECT * FROM learner_memory WHERE user_id = ?`;
      let params = [userId];
      
      if (memoryType) {
        query += ` AND memory_type = ?`;
        params.push(memoryType);
      }
      
      query += ` ORDER BY updated_at DESC`;
      
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  // Topic history methods
  recordTopicPractice: (id, userId, topic, mode, performanceScore) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO topic_history (id, user_id, topic, mode, performance_score) VALUES (?, ?, ?, ?, ?)`,
        [id, userId, topic, mode, performanceScore],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },

  getTopicHistory: (userId) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM topic_history WHERE user_id = ? ORDER BY updated_at DESC`,
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  },

  // Learning track methods
  createLearningTrack: (id, userId, trackName, currentLevel, targetLevel, sequence) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO learning_tracks (id, user_id, track_name, current_level, target_level, sequence) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, userId, trackName, currentLevel, targetLevel, sequence],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },

  getLearningTrack: (userId) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM learning_tracks WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  },

  updateLearningTrack: (trackId, updates) => {
    return new Promise((resolve, reject) => {
      const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      const values = [...Object.values(updates), trackId];
      
      db.run(
        `UPDATE learning_tracks SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },

  // Recommendation methods
  saveRecommendation: (id, userId, topic, reason, targetSkill, priority = 5) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO recommendations (id, user_id, topic, reason, target_skill, priority) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, userId, topic, reason, targetSkill, priority],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },

  getRecommendations: (userId, limit = 10) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM recommendations WHERE user_id = ? ORDER BY priority DESC, created_at DESC LIMIT ?`,
        [userId, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  },

  // Mock test methods
  createMockTest: (id, userId, testType) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO mock_tests (id, user_id, test_type, start_time) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
        [id, userId, testType],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },

  endMockTest: (mockTestId, duration, part1Score, part2Score, part3Score, feedback) => {
    return new Promise((resolve, reject) => {
      const overallScore = (part1Score + part2Score + part3Score) / 3;
      
      db.run(
        `UPDATE mock_tests SET end_time = CURRENT_TIMESTAMP, duration = ?, part1_score = ?, part2_score = ?, part3_score = ?, overall_score = ?, feedback = ? WHERE id = ?`,
        [duration, part1Score, part2Score, part3Score, overallScore, feedback, mockTestId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },

  getUserMockTests: (userId) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM mock_tests WHERE user_id = ? ORDER BY created_at DESC`,
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  },

  close: () => {
    return new Promise((resolve, reject) => {
      if (db) {
        db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }
};

module.exports = Database;
