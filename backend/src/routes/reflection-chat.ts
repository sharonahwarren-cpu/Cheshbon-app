import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, gt } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini client lazily - only when needed
let genAI: GoogleGenerativeAI | null = null;
let geminiInitError: string | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (geminiInitError) {
    throw new Error(geminiInitError);
  }

  if (!genAI) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      geminiInitError = 'Google API key is not configured';
      throw new Error(geminiInitError);
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }

  return genAI;
}

const SYSTEM_PROMPT = `You are a supportive AI reflection coach helping users with goal setting, tracking, and reflection. Keep responses concise (2-3 sentences max) and conversational. Ask thoughtful questions to help users reflect on their progress, struggles, and wins. Use the provided context about their goals and reflections to give personalized guidance.`;

const GREETING_STARTERS = ['Hi!', 'Hello!', 'Hey there!', 'Greetings!', 'Welcome!'];

function getRandomGreeting(): string {
  const starter = GREETING_STARTERS[Math.floor(Math.random() * GREETING_STARTERS.length)];
  return `${starter} What would you like to reflect about today?`;
}

export function registerReflectionChatRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // Validate Gemini API configuration on startup
  if (!process.env.GOOGLE_API_KEY) {
    app.logger.warn(
      'GOOGLE_API_KEY environment variable is not set. AI reflection chat features will not be available.'
    );
  } else {
    app.logger.info('Reflection chat routes registered - AI service available');
  }

  // POST /api/reflection-chat/conversations - Create a new reflection conversation
  app.fastify.post('/api/reflection-chat/conversations', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;

    app.logger.info({ userId }, 'Creating new reflection conversation');

    try {
      const conversations = await app.db
        .insert(schema.reflectionConversations)
        .values({
          userId,
          title: null,
        })
        .returning();

      const conversation = conversations[0];

      app.logger.info(
        { userId, conversationId: conversation.id },
        'Reflection conversation created successfully'
      );

      // Generate random greeting
      const greetingContent = getRandomGreeting();

      // Save greeting as first message in conversation
      try {
        await app.db
          .insert(schema.reflectionMessages)
          .values({
            conversationId: conversation.id,
            role: 'assistant',
            content: greetingContent,
          });

        app.logger.info(
          { userId, conversationId: conversation.id },
          'Initial greeting saved to conversation'
        );
      } catch (error) {
        app.logger.error(
          { err: error, userId, conversationId: conversation.id },
          'Failed to save initial greeting message'
        );
        // Don't fail the request if greeting save fails - return the greeting anyway
      }

      // Return conversation with initial greeting message
      return {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
        initialMessage: {
          content: greetingContent,
        },
      };
    } catch (error) {
      app.logger.error(
        { err: error, userId },
        'Failed to create reflection conversation'
      );
      throw error;
    }
  });

  // GET /api/reflection-chat/conversations - List all conversations for user
  app.fastify.get('/api/reflection-chat/conversations', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;

    app.logger.info({ userId }, 'Fetching reflection conversations');

    try {
      const conversations = await app.db
        .select()
        .from(schema.reflectionConversations)
        .where(eq(schema.reflectionConversations.userId, userId))
        .orderBy(desc(schema.reflectionConversations.updatedAt));

      app.logger.info(
        { userId, count: conversations.length },
        'Reflection conversations fetched successfully'
      );

      return conversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        createdAt: conv.createdAt.toISOString(),
        updatedAt: conv.updatedAt.toISOString(),
      }));
    } catch (error) {
      app.logger.error(
        { err: error, userId },
        'Failed to fetch reflection conversations'
      );
      throw error;
    }
  });

  // GET /api/reflection-chat/conversations/:id/messages - Get all messages for a conversation
  app.fastify.get(
    '/api/reflection-chat/conversations/:id/messages',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      const { id } = request.params as { id: string };

      app.logger.info({ userId, conversationId: id }, 'Fetching conversation messages');

      try {
        // Verify conversation belongs to user
        const conversations = await app.db
          .select()
          .from(schema.reflectionConversations)
          .where(
            and(
              eq(schema.reflectionConversations.id, id),
              eq(schema.reflectionConversations.userId, userId)
            )
          );

        if (!conversations.length) {
          app.logger.warn(
            { userId, conversationId: id },
            'Conversation not found or unauthorized'
          );
          return reply.status(404).send({ error: 'Conversation not found' });
        }

        const messages = await app.db
          .select()
          .from(schema.reflectionMessages)
          .where(eq(schema.reflectionMessages.conversationId, id))
          .orderBy(schema.reflectionMessages.createdAt);

        app.logger.info(
          { userId, conversationId: id, messageCount: messages.length },
          'Conversation messages fetched successfully'
        );

        return messages.map((msg) => ({
          id: msg.id,
          conversationId: msg.conversationId,
          role: msg.role,
          content: msg.content,
          createdAt: msg.createdAt.toISOString(),
        }));
      } catch (error) {
        app.logger.error(
          { err: error, userId, conversationId: id },
          'Failed to fetch conversation messages'
        );
        throw error;
      }
    }
  );

  // POST /api/reflection-chat/conversations/:id/messages - Send message and get AI response
  app.fastify.post(
    '/api/reflection-chat/conversations/:id/messages',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      const { id } = request.params as { id: string };
      const { message: messageText, audioBase64 } = request.body as { message?: string; audioBase64?: string };

      app.logger.info(
        { userId, conversationId: id, hasAudio: !!audioBase64, messageLength: messageText?.length },
        'Processing reflection message'
      );

      // Transcribe audio if provided
      let userMessage = messageText;

      if (audioBase64 && !messageText) {
        // Check if AI is configured
        if (!process.env.GOOGLE_API_KEY) {
          app.logger.warn(
            { userId, conversationId: id },
            'Voice transcription requested but AI is not configured'
          );
          return reply.status(400).send({
            error: 'Voice transcription requires AI configuration. Please use text mode instead.',
          });
        }

        try {
          app.logger.info({ userId, conversationId: id }, 'Transcribing audio message');

          const transcriptionModel = getGeminiClient().getGenerativeModel({
            model: 'gemini-2.0-flash',
          });

          // Create inline data object for Gemini
          const response = await transcriptionModel.generateContent([
            {
              inlineData: {
                mimeType: 'audio/wav',
                data: audioBase64,
              },
            },
            'Please transcribe this audio and return only the text transcription without any formatting or explanations.',
          ]);

          userMessage = response.response.text().trim();

          app.logger.info(
            { userId, conversationId: id, transcribedLength: userMessage.length },
            'Audio transcribed successfully'
          );
        } catch (transcriptionError) {
          app.logger.error(
            { err: transcriptionError, userId, conversationId: id },
            'Failed to transcribe audio'
          );
          return reply.status(400).send({
            error: 'Voice transcription requires AI configuration. Please use text mode instead.',
          });
        }
      }

      if (!userMessage) {
        app.logger.warn({ userId, conversationId: id }, 'No message or audio provided');
        return reply.status(400).send({
          error: 'Please provide either a message or audio data',
        });
      }

      try {
        // Verify conversation belongs to user
        const conversations = await app.db
          .select()
          .from(schema.reflectionConversations)
          .where(
            and(
              eq(schema.reflectionConversations.id, id),
              eq(schema.reflectionConversations.userId, userId)
            )
          );

        if (!conversations.length) {
          app.logger.warn(
            { userId, conversationId: id },
            'Conversation not found or unauthorized'
          );
          return reply.status(404).send({ error: 'Conversation not found' });
        }

        // Save user message
        const userMessageRecords = await app.db
          .insert(schema.reflectionMessages)
          .values({
            conversationId: id,
            role: 'user',
            content: userMessage,
          })
          .returning();

        const savedUserMessage = userMessageRecords[0];

        app.logger.info(
          { userId, conversationId: id, messageId: savedUserMessage.id },
          'User message saved'
        );

        // Fetch conversation history
        const conversationHistory = await app.db
          .select()
          .from(schema.reflectionMessages)
          .where(eq(schema.reflectionMessages.conversationId, id))
          .orderBy(schema.reflectionMessages.createdAt);

        // Fetch context
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

        const activeGoals = await app.db
          .select()
          .from(schema.goals)
          .where(
            and(
              eq(schema.goals.userId, userId),
              eq(schema.goals.isActive, true)
            )
          )
          .limit(10);

        const recentReflections = await app.db
          .select()
          .from(schema.reflections)
          .where(
            and(
              eq(schema.reflections.userId, userId),
              gt(schema.reflections.createdAt, sevenDaysAgo)
            )
          )
          .orderBy(desc(schema.reflections.createdAt))
          .limit(10);

        const recentJournalEntries = await app.db
          .select()
          .from(schema.journalEntries)
          .where(
            and(
              eq(schema.journalEntries.userId, userId),
              gt(schema.journalEntries.createdAt, threeDaysAgo)
            )
          )
          .orderBy(desc(schema.journalEntries.createdAt))
          .limit(5);

        // Build context string
        let contextStr = '';

        if (activeGoals.length > 0) {
          contextStr += 'Active Goals:\n';
          for (const goal of activeGoals) {
            contextStr += `- ${goal.title}${goal.description ? ': ' + goal.description : ''}\n`;
          }
          contextStr += '\n';
        }

        if (recentReflections.length > 0) {
          contextStr += 'Recent Reflections (Last 7 days):\n';
          for (const reflection of recentReflections) {
            contextStr += `- [${reflection.outcome}] ${reflection.description?.substring(0, 100) || ''}\n`;
          }
          contextStr += '\n';
        }

        if (recentJournalEntries.length > 0) {
          contextStr += 'Recent Journal Entries (Last 3 days):\n';
          for (const entry of recentJournalEntries) {
            contextStr += `- ${entry.content?.substring(0, 100) || ''}\n`;
          }
          contextStr += '\n';
        }

        // Build conversation messages for AI
        const conversationMessages = conversationHistory.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        }));

        // Call Gemini API
        let aiText: string;

        try {
          const model = getGeminiClient().getGenerativeModel({
            model: 'gemini-2.0-flash',
            systemInstruction: SYSTEM_PROMPT,
          });

          const chatSession = model.startChat({
            history: conversationMessages.slice(0, -1).map((msg) => ({
              role: msg.role === 'user' ? 'user' : 'model',
              parts: [{ text: msg.content }],
            })),
          });

          const response = await chatSession.sendMessage(
            `${contextStr}\nUser message: ${userMessage}`
          );

          aiText = response.response.text();
        } catch (aiError) {
          app.logger.error(
            { err: aiError, userId, conversationId: id },
            'AI service error'
          );
          return reply.status(503).send({
            error: 'AI service is currently unavailable. Please contact support.',
          });
        }

        app.logger.info(
          { userId, conversationId: id, responseLength: aiText.length },
          'AI response generated'
        );

        // Save AI response
        const aiMessages = await app.db
          .insert(schema.reflectionMessages)
          .values({
            conversationId: id,
            role: 'assistant',
            content: aiText,
          })
          .returning();

        const aiMessage = aiMessages[0];

        // Update conversation updatedAt
        await app.db
          .update(schema.reflectionConversations)
          .set({ updatedAt: new Date() })
          .where(eq(schema.reflectionConversations.id, id));

        app.logger.info(
          { userId, conversationId: id, messageId: aiMessage.id },
          'AI response saved successfully'
        );

        const responseObj: any = {
          response: aiText,
        };

        // Include transcribed text if audio was provided
        if (audioBase64 && !messageText) {
          responseObj.transcribedText = userMessage;
        }

        return responseObj;
      } catch (error) {
        app.logger.error(
          { err: error, userId, conversationId: id },
          'Failed to process reflection message'
        );
        throw error;
      }
    }
  );

  // DELETE /api/reflection-chat/conversations/:id - Delete conversation
  app.fastify.delete(
    '/api/reflection-chat/conversations/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      const { id } = request.params as { id: string };

      app.logger.info({ userId, conversationId: id }, 'Deleting reflection conversation');

      try {
        // Verify conversation belongs to user
        const conversations = await app.db
          .select()
          .from(schema.reflectionConversations)
          .where(
            and(
              eq(schema.reflectionConversations.id, id),
              eq(schema.reflectionConversations.userId, userId)
            )
          );

        if (!conversations.length) {
          app.logger.warn(
            { userId, conversationId: id },
            'Conversation not found or unauthorized'
          );
          return reply.status(404).send({ error: 'Conversation not found' });
        }

        // Delete all messages first
        await app.db
          .delete(schema.reflectionMessages)
          .where(eq(schema.reflectionMessages.conversationId, id));

        // Delete conversation
        await app.db
          .delete(schema.reflectionConversations)
          .where(eq(schema.reflectionConversations.id, id));

        app.logger.info(
          { userId, conversationId: id },
          'Reflection conversation deleted successfully'
        );

        return { success: true };
      } catch (error) {
        app.logger.error(
          { err: error, userId, conversationId: id },
          'Failed to delete reflection conversation'
        );
        throw error;
      }
    }
  );
}
