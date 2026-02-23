import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import fs from 'fs';
import path from 'path';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export function registerCheshbonRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/cheshbon/transcribe - Transcribe audio to text
  app.fastify.post('/api/cheshbon/transcribe', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Transcribing audio');

    try {
      if (!OPENAI_API_KEY) {
        app.logger.error({ userId: session.user.id }, 'OpenAI API key not configured');
        return reply.status(500).send({ error: 'OpenAI API key not configured' });
      }

      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'No audio file provided' });
      }

      const buffer = await data.toBuffer();
      const tempFilePath = path.join('/tmp', `audio-${Date.now()}.wav`);
      fs.writeFileSync(tempFilePath, buffer);

      try {
        // Call OpenAI Whisper API
        const formData = new FormData();
        const audioBlob = new Blob([buffer], { type: 'audio/wav' });
        formData.append('file', audioBlob, 'audio.wav');
        formData.append('model', 'whisper-1');

        const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: formData,
        });

        if (!transcriptionResponse.ok) {
          const error = await transcriptionResponse.text();
          app.logger.error({ userId: session.user.id, error }, 'Whisper API error');
          return reply.status(500).send({ error: 'Failed to transcribe audio' });
        }

        const transcriptionData = await transcriptionResponse.json() as { text: string };
        const transcription = transcriptionData.text;

        // Create a cheshbon session
        const sessions = await app.db
          .insert(schema.cheshbonSessions)
          .values({
            userId: session.user.id,
            sessionDate: new Date().toISOString().split('T')[0] as any,
            transcription,
            audioUrl: null,
          })
          .returning();

        const sessionData = sessions[0];

        app.logger.info({ userId: session.user.id, sessionId: sessionData.id }, 'Audio transcribed successfully');
        return { transcription, sessionId: sessionData.id };
      } finally {
        fs.unlinkSync(tempFilePath);
      }
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to transcribe audio');
      throw error;
    }
  });

  // POST /api/cheshbon/analyze - Analyze transcription and suggest mitzvot
  app.fastify.post('/api/cheshbon/analyze', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const body = request.body as { sessionId: string; transcription: string };

    app.logger.info({ userId: session.user.id, sessionId: body.sessionId }, 'Analyzing cheshbon');

    try {
      if (!OPENAI_API_KEY) {
        app.logger.error({ userId: session.user.id }, 'OpenAI API key not configured');
        return reply.status(500).send({ error: 'OpenAI API key not configured' });
      }

      // Check session ownership
      const sessions = await app.db
        .select()
        .from(schema.cheshbonSessions)
        .where(eq(schema.cheshbonSessions.id, body.sessionId))
        .limit(1);

      if (!sessions.length) {
        app.logger.warn({ userId: session.user.id, sessionId: body.sessionId }, 'Session not found');
        return reply.status(404).send({ error: 'Session not found' });
      }

      if (sessions[0].userId !== session.user.id) {
        app.logger.warn({ userId: session.user.id, sessionId: body.sessionId }, 'Unauthorized access to session');
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      const prompt = `Based on this person's reflection, suggest 3-7 relevant mitzvot categories from: God/Faith, Torah Study, Prayer/Blessings, Signs/Symbols, Interpersonal, Charity, Family/Marriage, Dietary Laws, Business/Ethics, Holidays/Shabbat, General Prohibitions.

For each suggestion, include: category name, brief reason (1-2 sentences), likely status (upheld/lapsed).

Output as JSON array: [{ category, reason, status }]

Reflection: ${body.transcription}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        app.logger.error({ userId: session.user.id, error }, 'GPT-4 API error');
        return reply.status(500).send({ error: 'Failed to analyze reflection' });
      }

      const data = await response.json() as any;
      const content = data.choices[0].message.content;

      // Parse JSON from response
      let suggestions = [];
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        app.logger.warn({ userId: session.user.id }, 'Failed to parse AI response as JSON');
        suggestions = [];
      }

      // Update session with suggestions
      await app.db
        .update(schema.cheshbonSessions)
        .set({
          aiSuggestions: suggestions,
          updatedAt: new Date(),
        })
        .where(eq(schema.cheshbonSessions.id, body.sessionId));

      app.logger.info({ userId: session.user.id, sessionId: body.sessionId, count: suggestions.length }, 'Cheshbon analyzed successfully');
      return { suggestions };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to analyze cheshbon');
      throw error;
    }
  });

  // GET /api/cheshbon/sessions - Get all cheshbon sessions
  app.fastify.get('/api/cheshbon/sessions', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching cheshbon sessions');

    try {
      const sessions = await app.db
        .select()
        .from(schema.cheshbonSessions)
        .where(eq(schema.cheshbonSessions.userId, session.user.id))
        .orderBy(desc(schema.cheshbonSessions.sessionDate));

      app.logger.info({ userId: session.user.id, count: sessions.length }, 'Cheshbon sessions fetched successfully');
      return sessions;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch cheshbon sessions');
      throw error;
    }
  });

  // GET /api/cheshbon/sessions/:id - Get session details with conversation history
  app.fastify.get('/api/cheshbon/sessions/:id', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };

    app.logger.info({ userId: session.user.id, sessionId: id }, 'Fetching cheshbon session details');

    try {
      const sessions = await app.db
        .select()
        .from(schema.cheshbonSessions)
        .where(eq(schema.cheshbonSessions.id, id))
        .limit(1);

      if (!sessions.length) {
        app.logger.warn({ userId: session.user.id, sessionId: id }, 'Session not found');
        return reply.status(404).send({ error: 'Session not found' });
      }

      if (sessions[0].userId !== session.user.id) {
        app.logger.warn({ userId: session.user.id, sessionId: id }, 'Unauthorized access to session');
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      const sessionData = sessions[0];

      // Get conversation history
      const messages = await app.db
        .select()
        .from(schema.cheshbonMessages)
        .where(eq(schema.cheshbonMessages.sessionId, id))
        .orderBy(schema.cheshbonMessages.createdAt);

      app.logger.info({ userId: session.user.id, sessionId: id, messageCount: messages.length }, 'Session details fetched successfully');
      return { ...sessionData, messages };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, sessionId: id }, 'Failed to fetch cheshbon session details');
      throw error;
    }
  });

  // POST /api/cheshbon/sessions/:id/messages - Send message and get AI response
  app.fastify.post('/api/cheshbon/sessions/:id/messages', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const body = request.body as { message: string };

    app.logger.info({ userId: session.user.id, sessionId: id }, 'Sending cheshbon message');

    try {
      if (!OPENAI_API_KEY) {
        app.logger.error({ userId: session.user.id }, 'OpenAI API key not configured');
        return reply.status(500).send({ error: 'OpenAI API key not configured' });
      }

      // Check session ownership
      const sessions = await app.db
        .select()
        .from(schema.cheshbonSessions)
        .where(eq(schema.cheshbonSessions.id, id))
        .limit(1);

      if (!sessions.length) {
        app.logger.warn({ userId: session.user.id, sessionId: id }, 'Session not found');
        return reply.status(404).send({ error: 'Session not found' });
      }

      if (sessions[0].userId !== session.user.id) {
        app.logger.warn({ userId: session.user.id, sessionId: id }, 'Unauthorized access to session');
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Save user message
      await app.db
        .insert(schema.cheshbonMessages)
        .values({
          sessionId: id,
          userId: session.user.id,
          role: 'user',
          content: body.message,
        });

      // Get conversation history
      const messages = await app.db
        .select()
        .from(schema.cheshbonMessages)
        .where(eq(schema.cheshbonMessages.sessionId, id))
        .orderBy(schema.cheshbonMessages.createdAt);

      // Build conversation for GPT
      const conversationMessages = [
        {
          role: 'system',
          content: `You are a compassionate Jewish life coach helping someone reflect on their mitzvot observance (commandments/obligations in Judaism).
Your role is to ask probing, thoughtful questions to help them examine which mitzvot they're upheld and which they're struggling with.
Be encouraging and non-judgmental. Reference the categories: God/Faith, Torah Study, Prayer/Blessings, Signs/Symbols, Interpersonal, Charity, Family/Marriage, Dietary Laws, Business/Ethics, Holidays/Shabbat, General Prohibitions.
Help them think deeply about their spiritual practice and growth areas.`,
        },
        ...messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
        })),
      ];

      // Get AI response
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: conversationMessages,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        app.logger.error({ userId: session.user.id, error }, 'GPT-4 API error');
        return reply.status(500).send({ error: 'Failed to get AI response' });
      }

      const data = await response.json() as any;
      const aiResponse = data.choices[0].message.content;

      // Save AI response
      await app.db
        .insert(schema.cheshbonMessages)
        .values({
          sessionId: id,
          userId: session.user.id,
          role: 'assistant',
          content: aiResponse,
        });

      // Update session
      await app.db
        .update(schema.cheshbonSessions)
        .set({
          updatedAt: new Date(),
        })
        .where(eq(schema.cheshbonSessions.id, id));

      app.logger.info({ userId: session.user.id, sessionId: id }, 'Cheshbon message processed successfully');
      return { response: aiResponse };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, sessionId: id }, 'Failed to process cheshbon message');
      throw error;
    }
  });

  // DELETE /api/cheshbon/sessions/:id - Delete a session
  app.fastify.delete('/api/cheshbon/sessions/:id', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };

    app.logger.info({ userId: session.user.id, sessionId: id }, 'Deleting cheshbon session');

    try {
      const sessions = await app.db
        .select()
        .from(schema.cheshbonSessions)
        .where(eq(schema.cheshbonSessions.id, id))
        .limit(1);

      if (!sessions.length) {
        app.logger.warn({ userId: session.user.id, sessionId: id }, 'Session not found');
        return reply.status(404).send({ error: 'Session not found' });
      }

      if (sessions[0].userId !== session.user.id) {
        app.logger.warn({ userId: session.user.id, sessionId: id }, 'Unauthorized access to session');
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Delete session and all related messages
      await app.db.delete(schema.cheshbonSessions).where(eq(schema.cheshbonSessions.id, id));

      app.logger.info({ userId: session.user.id, sessionId: id }, 'Cheshbon session deleted successfully');
      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, sessionId: id }, 'Failed to delete cheshbon session');
      throw error;
    }
  });
}
