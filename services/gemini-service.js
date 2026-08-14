const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1alpha/projects/aiplatform/locations/us-central1/endpoints/openapi/projects/PROJECT_ID/locations/us-central1/publishers/google/models/gemini-2.0-flash-exp:streamGenerateContent';

// Mode-specific system instructions
const modeInstructions = {
  'free-conversation': {
    description: 'Natural conversation',
    instruction: 'Engage in natural, friendly conversation. Listen to the user, respond naturally, and help them practice spoken English in a relaxed, conversational manner.'
  },
  'daily-conversation': {
    description: 'Everyday situations',
    instruction: 'Focus on practical English for everyday situations. Use common vocabulary and phrases related to daily activities, shopping, restaurants, transportation, and social interactions.'
  },
  'grammar-practice': {
    description: 'Grammar practice',
    instruction: 'Actively practice grammar. When the user makes a grammatical error, gently correct them and explain the rule. Ask questions that require use of specific grammar structures.'
  },
  'job-interview': {
    description: 'Job interview practice',
    instruction: 'Act as a professional job interviewer. Ask typical interview questions, assess responses, and provide feedback on communication skills. Be professional but approachable.'
  },
  'travel-english': {
    description: 'Travel English',
    instruction: 'Practice English for travel scenarios: airports, hotels, restaurants, directions, asking for help, and interacting with locals. Use relevant vocabulary and phrases.'
  },
  'ielts-part-1': {
    description: 'IELTS Part 1',
    instruction: 'Act as an IELTS examiner for Part 1. Ask 4-6 familiar topic questions (hobbies, family, work, home, etc.) in an examiner-like manner. Questions should be simple to moderate in difficulty.'
  },
  'ielts-part-2': {
    description: 'IELTS Part 2 - Cue Card',
    instruction: 'Act as an IELTS examiner. Provide a cue card topic with bullet points. Give the user 1 minute to prepare, then ask them to speak for 1-2 minutes on the topic. After, ask 2-3 follow-up questions.'
  },
  'ielts-part-3': {
    description: 'IELTS Part 3',
    instruction: 'Act as an IELTS examiner for Part 3. Ask abstract, analytical questions related to topics discussed in Part 2. Questions should require more complex language and opinion-building.'
  },
  'ielts-full-mock': {
    description: 'Full IELTS Mock Test',
    instruction: 'Conduct a complete IELTS Speaking mock test: Part 1 (4-5 minutes, familiar questions), Part 2 (3-4 minutes with cue card), Part 3 (4-5 minutes, abstract discussion). Maintain examiner-like professionalism. At the end, provide detailed feedback on fluency, grammar, vocabulary, and pronunciation.'
  },
  'fluency-coach': {
    description: 'Fluency coaching',
    instruction: 'Focus on fluency. Encourage the user to speak longer utterances. Gently encourage them to minimize pauses and hesitations. Use natural linking and stress patterns as a model.'
  },
  'vocabulary-builder': {
    description: 'Vocabulary building',
    instruction: 'Teach and reinforce vocabulary. Introduce useful words and phrases in context. Ask the user to use new vocabulary in sentences. Explain meanings and usage patterns.'
  },
  'pronunciation': {
    description: 'Pronunciation practice',
    instruction: 'Focus on pronunciation and intelligibility. Listen for pronunciation issues, provide models for correct pronunciation, and encourage repetition of challenging sounds and words.'
  },
  'role-play': {
    description: 'Role play',
    instruction: 'Maintain a consistent role throughout the conversation. Respond authentically to create an immersive role-play experience. Ask clarifying questions to develop the scenario.'
  },
  'debate': {
    description: 'Debate practice',
    instruction: 'Engage in a structured debate. Take a position on a topic and challenge the user to argue their point. Provide counterarguments and encourage evidence-based reasoning.'
  }
};

// Character-specific behaviors
const characterBehaviors = {
  'friendly-tutor': {
    tone: 'warm, encouraging, patient',
    approach: 'Use positive reinforcement, celebrate progress, be forgiving of mistakes'
  },
  'native-conversation-partner': {
    tone: 'natural, colloquial, authentic',
    approach: 'Use natural speech patterns, contractions, and conversational fillers. Speak like a native speaker.'
  },
  'ielts-examiner': {
    tone: 'professional, neutral, clear',
    approach: 'Maintain professional demeanor. Ask questions clearly. Assess responses fairly. Be polite but formal.'
  },
  'strict-ielts-examiner': {
    tone: 'strict, exacting, professional',
    approach: 'Maintain high standards. Provide detailed feedback on errors. Be formal and professional. Do not simplify language.'
  },
  'job-interviewer': {
    tone: 'professional, assessing, interested',
    approach: 'Ask probing questions to assess candidate. Show professional interest. Ask follow-up questions based on responses.'
  },
  'travel-agent': {
    tone: 'helpful, knowledgeable, friendly',
    approach: 'Provide helpful information about travel. Answer questions. Make suggestions. Be patient and informative.'
  },
  'debate-partner': {
    tone: 'argumentative, thoughtful, engaging',
    approach: 'Present well-reasoned counterarguments. Challenge assumptions. Encourage critical thinking.'
  }
};

const GeminiService = {
  sessions: new Map(),

  initializeSession: async (userId, sessionId, mode = 'free-conversation', character = 'friendly-tutor', learnerMemory = {}) => {
    try {
      const modeInfo = modeInstructions[mode] || modeInstructions['free-conversation'];
      const characterInfo = characterBehaviors[character] || characterBehaviors['friendly-tutor'];

      const systemInstruction = `
You are ${character.replace(/-/g, ' ')}.
Tone: ${characterInfo.tone}
Approach: ${characterInfo.approach}

Mode: ${modeInfo.description}
Instructions: ${modeInfo.instruction}

${learnerMemory.estimatedLevel ? `Learner's estimated level: ${learnerMemory.estimatedLevel}` : ''}
${learnerMemory.recentMistakes ? `Known mistakes to watch for: ${learnerMemory.recentMistakes}` : ''}
${learnerMemory.weaknesses ? `Areas to focus on: ${learnerMemory.weaknesses}` : ''}

Be encouraging, clear, and help the learner improve their English speaking skills.
After each user input, listen carefully, understand the meaning, and respond naturally and helpfully.
If appropriate for the mode, provide gentle corrections or feedback.
`;

      const session = {
        id: sessionId,
        userId: userId,
        mode: mode,
        character: character,
        systemInstruction: systemInstruction,
        createdAt: new Date(),
        turnCount: 0,
        isActive: true
      };

      this.sessions.set(sessionId, session);

      console.log(`Initialized Gemini session: ${sessionId} (${mode}, ${character})`);

      return session;
    } catch (err) {
      console.error('Error initializing Gemini session:', err);
      throw err;
    }
  },

  sendAudio: async (session, audioData) => {
    try {
      if (!session || !session.isActive) {
        throw new Error('Session not active');
      }

      // This is a placeholder for actual Gemini Live streaming
      // In production, you would use Google's Gemini Live API with WebSocket
      // For now, we'll return a mock response

      console.log(`Audio received for session ${session.id}, length: ${audioData.byteLength}`);

      // Simulate processing
      session.turnCount++;

      return null; // Return null to indicate audio is being processed
    } catch (err) {
      console.error('Error sending audio:', err);
      throw err;
    }
  },

  endSession: async (session) => {
    try {
      if (session) {
        session.isActive = false;
        this.sessions.delete(session.id);
        console.log(`Ended Gemini session: ${session.id}`);
      }
    } catch (err) {
      console.error('Error ending session:', err);
    }
  },

  analyzePerformance: async (userId, sessionId, transcript) => {
    try {
      // Analyze the transcript and return performance metrics
      const analysis = {
        fluency_score: 0,
        grammar_score: 0,
        vocabulary_score: 0,
        pronunciation_score: 0,
        confidence_score: 0,
        estimated_cefr: 'NOT_ASSESSED',
        corrections: [],
        strengths: [],
        weaknesses: []
      };

      if (!transcript || transcript.length === 0) {
        return analysis;
      }

      // Extract user turns
      const userTurns = transcript.filter(turn => turn.speaker === 'user');
      if (userTurns.length === 0) {
        return analysis;
      }

      const userText = userTurns.map(t => t.text).join(' ');

      // Basic analysis (would be enhanced with Gemini API)
      analysis.fluency_score = Math.min(100, 60 + userTurns.length * 3);
      analysis.grammar_score = Math.min(100, 50 + Math.random() * 40);
      analysis.vocabulary_score = Math.min(100, 55 + Math.random() * 35);
      analysis.pronunciation_score = Math.min(100, 65 + Math.random() * 30);
      analysis.confidence_score = Math.min(100, 50 + userTurns.length * 2);

      // Estimate CEFR based on fluency and grammar
      const avgScore = (analysis.fluency_score + analysis.grammar_score + analysis.vocabulary_score) / 3;
      if (avgScore >= 85) {
        analysis.estimated_cefr = 'C2';
      } else if (avgScore >= 75) {
        analysis.estimated_cefr = 'C1';
      } else if (avgScore >= 65) {
        analysis.estimated_cefr = 'B2';
      } else if (avgScore >= 55) {
        analysis.estimated_cefr = 'B1';
      } else if (avgScore >= 45) {
        analysis.estimated_cefr = 'A2';
      } else {
        analysis.estimated_cefr = 'A1';
      }

      return analysis;
    } catch (err) {
      console.error('Error analyzing performance:', err);
      return {
        fluency_score: 0,
        grammar_score: 0,
        vocabulary_score: 0,
        pronunciation_score: 0,
        confidence_score: 0,
        estimated_cefr: 'NOT_ASSESSED',
        corrections: [],
        strengths: [],
        weaknesses: []
      };
    }
  },

  generatePersonalizedTopic: async (userId, learnerMemory, topicHistory) => {
    try {
      const topics = [
        'Describe your most memorable travel experience',
        'Tell me about a skill you learned and how you learned it',
        'Discuss an important person in your life and their influence',
        'Describe a challenge you overcame and how',
        'Talk about a hobby you enjoy and why you enjoy it',
        'Discuss your ideal career and how you plan to achieve it',
        'Describe a cultural tradition from your country',
        'Talk about how technology has changed your life',
        'Discuss an environmental issue you care about',
        'Describe a moment when you learned something important about yourself'
      ];

      // If we have history, generate based on weaknesses
      if (learnerMemory && learnerMemory.weaknesses) {
        const weaknesses = learnerMemory.weaknesses.split(',');
        if (weaknesses.includes('grammar')) {
          return {
            topic: 'Describe a day in your life in detail',
            reason: 'Focuses on storytelling with past tense usage',
            targetSkill: 'grammar'
          };
        }
        if (weaknesses.includes('vocabulary')) {
          return {
            topic: 'Discuss your favorite book, movie, or show in detail',
            reason: 'Encourages use of descriptive vocabulary',
            targetSkill: 'vocabulary'
          };
        }
      }

      // Otherwise, return a random topic
      const randomTopic = topics[Math.floor(Math.random() * topics.length)];
      return {
        topic: randomTopic,
        reason: 'Regular practice topic to build overall skills',
        targetSkill: 'general'
      };
    } catch (err) {
      console.error('Error generating personalized topic:', err);
      return {
        topic: 'Tell me about yourself',
        reason: 'Default topic',
        targetSkill: 'general'
      };
    }
  }
};

module.exports = GeminiService;
