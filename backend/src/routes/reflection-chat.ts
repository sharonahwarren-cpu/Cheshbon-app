import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, gt } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const SYSTEM_PROMPT = `You are a supportive and insightful self-improvement coach. Help the user reflect on their goals, successes, and struggles. Ask thoughtful questions, provide encouragement, and help them gain clarity on their personal growth journey. Be empathetic, non-judgmental, and focus on actionable insights. Keep responses concise and conversational.`;

export function registerReflectionChatRoutes(app: App) {
  const requireAuth = app.requireAuth();

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

      return {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt.toISOString(),
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

      // Get message counts for each conversation
      const conversationsWithCounts = await Promise.all(
        conversations.map(async (conv) => {
          const messages = await app.db
            .select()
            .from(schema.reflectionMessages)
            .where(eq(schema.reflectionMessages.conversationId, conv.id));

          return {
            id: conv.id,
            title: conv.title,
            createdAt: conv.createdAt.toISOString(),
            updatedAt: conv.updatedAt.toISOString(),
            messageCount: messages.length,
          };
        })
      );

      app.logger.info(
        { userId, count: conversationsWithCounts.length },
        'Reflection conversations fetched successfully'
      );

      return conversationsWithCounts;
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
      const { message } = request.body as { message: string };

      app.logger.info(
        { userId, conversationId: id, messageLength: message?.length },
        'Processing reflection message'
      );

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
        const userMessages = await app.db
          .insert(schema.reflectionMessages)
          .values({
            conversationId: id,
            role: 'user',
            content: message,
          })
          .returning();

        const userMessage = userMessages[0];

        app.logger.info(
          { userId, conversationId: id, messageId: userMessage.id },
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
            contextStr += `- [${reflection.outcome}] ${reflection.description?.substring(0, 100)}\n`;
          }
          contextStr += '\n';
        }

        if (recentJournalEntries.length > 0) {
          contextStr += 'Recent Journal Entries (Last 3 days):\n';
          for (const entry of recentJournalEntries) {
            contextStr += `- ${entry.content?.substring(0, 100)}\n`;
          }
          contextStr += '\n';
        }

        // Build conversation messages for AI
        const conversationMessages = conversationHistory.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        }));

        // Call Gemini API
        const model = genAI.getGenerativeModel({
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
          `${contextStr}\nUser message: ${message}`
        );

        const aiText = response.response.text();

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

        // Generate or update title if it's the first message
        if (conversationHistory.length === 1) {
          const titleModel = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
          });

          const titleResponse = await titleModel.generateContent(
            `Generate a short 3-4 word title for this reflection conversation based on: "${message}". Return ONLY the title, no quotes or punctuation.`
          );

          const title = titleResponse.response.text().trim();

          await app.db
            .update(schema.reflectionConversations)
            .set({ title })
            .where(eq(schema.reflectionConversations.id, id));

          app.logger.info(
            { userId, conversationId: id, title },
            'Conversation title generated'
          );
        }

        app.logger.info(
          { userId, conversationId: id, messageId: aiMessage.id },
          'AI response saved successfully'
        );

        return {
          id: aiMessage.id,
          role: 'assistant',
          content: aiText,
          createdAt: aiMessage.createdAt.toISOString(),
        };
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

        // Delete conversation (cascade will delete messages)
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
