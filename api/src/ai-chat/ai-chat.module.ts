import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  Logger,
  Module,
  Param,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { SupabaseService } from '../supabase/supabase.service';
import { CurrentUser } from '../common/decorators';
import { AuthUser } from '../common/types';
import { unwrap, unwrapOne } from '../common/db';

export class ChatRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  message!: string;

  @IsOptional()
  @IsUUID()
  conversationId?: string;
}

export interface AiSource {
  type: 'knowledge_article' | 'barangay_service' | 'announcement' | 'community_location';
  id: string;
  title: string;
  verified: boolean;
}

export interface AiSuggestedAction {
  label: string;
  href: string;
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'how', 'what', 'where', 'when', 'who', 'can', 'get', 'need',
  'want', 'please', 'help', 'about', 'from', 'into', 'this', 'that', 'are', 'is', 'in', 'to',
  'of', 'on', 'at', 'a', 'an', 'my', 'our', 'do', 'i', 'sa', 'ang', 'ng', 'mga', 'unsa', 'asa',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
}

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);
  private readonly geminiKey: string;
  private readonly geminiModel: string;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {
    this.geminiKey = (this.config.get<string>('GEMINI_API_KEY') ?? '').trim();
    this.geminiModel = (this.config.get<string>('GEMINI_MODEL') ?? 'gemini-2.5-flash').trim();
  }

  status() {
    const geminiConfigured = this.geminiKey.length > 10;
    return {
      engine: geminiConfigured ? ('gemini' as const) : ('knowledge_base' as const),
      gemini_configured: geminiConfigured,
      model: geminiConfigured ? this.geminiModel : null,
    };
  }

  async listConversations(userId: string) {
    return unwrap(
      await this.supabase.admin
        .from('ai_conversations')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(40),
      'Failed to load AI conversations',
    );
  }

  async listMessages(user: AuthUser, conversationId: string) {
    const conv = unwrapOne(
      await this.supabase.admin
        .from('ai_conversations')
        .select('*')
        .eq('id', conversationId)
        .single(),
      'Conversation',
    );
    if (conv.user_id !== user.id) {
      throw new ForbiddenException('You do not have access to this conversation');
    }
    return unwrap(
      await this.supabase.admin
        .from('ai_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true }),
      'Failed to load conversation messages',
    );
  }

  async deleteConversation(user: AuthUser, conversationId: string) {
    const conv = unwrapOne(
      await this.supabase.admin
        .from('ai_conversations')
        .select('*')
        .eq('id', conversationId)
        .single(),
      'Conversation',
    );
    if (conv.user_id !== user.id) {
      throw new ForbiddenException('You do not have access to this conversation');
    }
    unwrap(
      await this.supabase.admin.from('ai_conversations').delete().eq('id', conversationId),
      'Failed to delete conversation',
    );
    return { success: true };
  }

  private async retrieveContext(message: string) {
    const tokens = tokenize(message);
    const nowIso = new Date().toISOString();

    const [
      { data: articles },
      { data: services },
      { data: announcements },
      { data: locations },
      { data: sensors },
    ] = await Promise.all([
      this.supabase.admin.from('knowledge_articles').select('*').eq('is_active', true),
      this.supabase.admin.from('barangay_services').select('*').eq('is_active', true),
      this.supabase.admin
        .from('announcements')
        .select('*')
        .eq('is_published', true)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order('is_pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(8),
      this.supabase.admin.from('community_locations').select('*').eq('is_public', true),
      this.supabase.admin.from('flood_sensors').select('*').eq('is_active', true),
    ]);

    const scoreText = (haystack: string, keywords: string[] = []): number => {
      if (tokens.length === 0) return 0;
      const lower = haystack.toLowerCase();
      const kwSet = new Set(keywords.map((k) => k.toLowerCase()));
      let hits = 0;
      for (const t of tokens) {
        if (kwSet.has(t)) hits += 3;
        else if (lower.includes(t)) hits += 1;
      }
      return hits;
    };

    const matchedArticles = (articles ?? [])
      .map((a: Record<string, unknown> & { question: string; answer: string; keywords: string[] }) => ({
        row: a,
        score: scoreText(`${a.question} ${a.answer}`, a.keywords ?? []),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => x.row);

    const matchedServices = (services ?? [])
      .map((s: Record<string, unknown> & { name: string; description: string; category: string }) => ({
        row: s,
        score: scoreText(`${s.name} ${s.description} ${s.category}`, [s.category, s.name]),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => x.row);

    const matchedAnnouncements = (announcements ?? [])
      .map((a: Record<string, unknown> & { title: string; summary: string | null; body: string }) => ({
        row: a,
        score: scoreText(`${a.title} ${a.summary ?? ''} ${a.body}`),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((x) => x.row);

    const matchedLocations = (locations ?? [])
      .map(
        (l: Record<string, unknown> & { name: string; category: string; description: string | null; address: string | null }) => ({
          row: l,
          score: scoreText(
            `${l.name} ${l.category.replace(/_/g, ' ')} ${l.description ?? ''} ${l.address ?? ''}`,
            [l.category.replace(/_/g, ' ')],
          ),
        }),
      )
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((x) => x.row);

    return {
      matchedArticles,
      matchedServices,
      matchedAnnouncements,
      matchedLocations,
      allServices: services ?? [],
      latestAnnouncements: (announcements ?? []).slice(0, 3),
      allLocations: locations ?? [],
      sensors: sensors ?? [],
    };
  }

  private buildSuggestedActions(message: string): AiSuggestedAction[] {
    const q = message.toLowerCase();
    const actions: AiSuggestedAction[] = [];

    if (/\b(emergency|fire|flood|medical|ambulance|crime|accident|earthquake|rescue)\b/.test(q)) {
      actions.push({ label: 'Report an Emergency', href: '/app/emergency/new' });
      actions.push({ label: 'Open Flood Monitor', href: '/app/flood' });
    }
    if (/\b(garbage|trash|waste|dumping|drainage|canal|sanitation|clean|pollution)\b/.test(q)) {
      actions.push({ label: 'Submit Cleanliness Report', href: '/app/clean' });
    }
    if (/\b(report|concern|streetlight|road|pothole|noise|stray|obstacle)\b/.test(q)) {
      actions.push({ label: 'Submit Community Report', href: '/app/reports/new' });
    }
    if (/\b(clearance|certificate|indigency|residency|permit|blotter|id|service|requirement)\b/.test(q)) {
      actions.push({ label: 'Browse Barangay Services', href: '/app/services' });
    }
    if (/\b(evacuation|map|location|health center|clinic|school|hall|station|where|nearest)\b/.test(q)) {
      actions.push({ label: 'Open Community Map', href: '/app/map' });
    }
    if (/\b(volunteer|bayanihan|activity|event|clean-up|program|register)\b/.test(q)) {
      actions.push({ label: 'Explore Bayanihan Activities', href: '/app/bayanihan' });
    }
    if (/\b(announcement|news|update|notice|advisory)\b/.test(q)) {
      actions.push({ label: 'Read Announcements', href: '/app/announcements' });
    }

    if (actions.length === 0) {
      actions.push(
        { label: 'Barangay Services Directory', href: '/app/services' },
        { label: 'Submit a Report', href: '/app/reports/new' },
        { label: 'View Community Map', href: '/app/map' },
      );
    }
    return actions.slice(0, 3);
  }

  private composeKnowledgeBaseReply(
    message: string,
    ctx: Awaited<ReturnType<AiChatService['retrieveContext']>>,
  ): { content: string; sources: AiSource[] } {
    const q = message.toLowerCase();
    const sections: string[] = [];
    const sources: AiSource[] = [];

    if (/\b(emergency|911|fire|medical|ambulance|drowning|bleeding|trapped)\b/.test(q)) {
      sections.push(
        '**Immediate Emergency Guidance:** If life or property is in immediate danger, call **911** (National Emergency Hotline), **160** (BFP Fire), or **117** (PNP) right away. You can also submit a geotagged incident through **I-Link Emergency** so barangay responders are alerted in real time.',
      );
    }

    for (const a of ctx.matchedArticles) {
      sections.push(`**${a.question}**\n${a.answer}`);
      sources.push({
        type: 'knowledge_article',
        id: a.id as string,
        title: `${a.question} (${a.source})`,
        verified: true,
      });
    }

    for (const s of ctx.matchedServices) {
      const reqs = Array.isArray(s.requirements) && s.requirements.length > 0
        ? `\n- **Requirements:** ${(s.requirements as string[]).join('; ')}`
        : '';
      const steps = Array.isArray(s.procedure_steps) && s.procedure_steps.length > 0
        ? `\n- **Procedure:** ${(s.procedure_steps as string[]).join(' → ')}`
        : '';
      const meta = [
        s.fee ? `**Fee:** ${s.fee}` : null,
        s.processing_time ? `**Processing:** ${s.processing_time}` : null,
        s.office_hours ? `**Hours:** ${s.office_hours}` : null,
        s.office ? `**Office:** ${s.office}` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      sections.push(
        `**Barangay Service — ${s.name}**\n${s.description}${reqs}${steps}${meta ? `\n- ${meta}` : ''}`,
      );
      sources.push({
        type: 'barangay_service',
        id: s.id as string,
        title: s.name as string,
        verified: true,
      });
    }

    const asksLocations =
      ctx.matchedLocations.length > 0 ||
      /\b(evacuation|center|health|school|hall|map|where|facility)\b/.test(q);
    if (asksLocations) {
      const locs =
        ctx.matchedLocations.length > 0
          ? ctx.matchedLocations
          : ctx.allLocations.filter((l: { category: string }) =>
              /\bevacuation\b/.test(q) ? l.category === 'evacuation_center' : true,
            ).slice(0, 4);

      if (locs.length > 0) {
        const lines = locs.map(
          (l: {
            id: string;
            name: string;
            category: string;
            address?: string | null;
            contact_number?: string | null;
            capacity?: number | null;
            is_accessible?: boolean;
          }) => {
            sources.push({
              type: 'community_location',
              id: l.id,
              title: l.name,
              verified: true,
            });
            const extras = [
              l.address,
              l.capacity ? `Capacity: ${l.capacity}` : null,
              l.is_accessible ? 'PWD-accessible' : null,
              l.contact_number ? `Tel: ${l.contact_number}` : null,
            ]
              .filter(Boolean)
              .join(' · ');
            return `- **${l.name}** (${l.category.replace(/_/g, ' ')})${extras ? ` — ${extras}` : ''}`;
          },
        );
        sections.push(`**Verified Community Locations:**\n${lines.join('\n')}`);
      }
    }

    if (/\b(flood|water level|sensor|pagasa|alert|rain|river)\b/.test(q) && ctx.sensors.length > 0) {
      const lines = ctx.sensors.map(
        (s: {
          name: string;
          location_text: string;
          current_tier: string;
          last_depth_cm: number | null;
          last_rise_cm_min: number | null;
        }) =>
          `- **${s.name}** (${s.location_text}): Tier **${s.current_tier.toUpperCase()}**, depth ${s.last_depth_cm ?? 0} cm, rise rate ${s.last_rise_cm_min ?? 0} cm/min`,
      );
      sections.push(`**Live Flood Monitoring Telemetry:**\n${lines.join('\n')}`);
    }

    const anns =
      ctx.matchedAnnouncements.length > 0
        ? ctx.matchedAnnouncements
        : /\b(announcement|news|update|advisory|notice|latest)\b/.test(q)
          ? ctx.latestAnnouncements
          : [];
    if (anns.length > 0) {
      const lines = anns.map(
        (a: { id: string; title: string; summary?: string | null; body: string; priority: string }) => {
          sources.push({
            type: 'announcement',
            id: a.id,
            title: a.title,
            verified: true,
          });
          return `- **[${a.priority.toUpperCase()}] ${a.title}** — ${a.summary || a.body.slice(0, 160)}`;
        },
      );
      sections.push(`**Verified Barangay Announcements:**\n${lines.join('\n')}`);
    }

    if (sections.length === 0) {
      const serviceNames = ctx.allServices
        .slice(0, 5)
        .map((s: { name: string }) => s.name)
        .join(', ');
      sections.push(
        `I am **I-Link AI**, your automated community assistant. I only answer from verified barangay records so I never fabricate official policies.\n\nHere is what I can help you with right now:\n- **Barangay Services & Requirements** (${serviceNames || 'Clearances, Certificates, Permits'})\n- **Submitting Reports:** Emergency incidents (**I-Link Emergency**), waste/drainage issues (**I-Link Clean**), or infrastructure/accessibility concerns\n- **Emergency & Flood Preparedness:** Evacuation centers, live flood sensor tiers, and safety checklists\n- **Community Participation:** Upcoming **I-Link Bayanihan** volunteer activities and official announcements`,
      );
    }

    const dedupSources = Array.from(
      new Map(sources.map((s) => [`${s.type}:${s.id}`, s])).values(),
    );

    return {
      content: sections.join('\n\n'),
      sources: dedupSources,
    };
  }

  private async tryGeminiReply(
    userMessage: string,
    kbFallback: { content: string; sources: AiSource[] },
  ): Promise<{ content: string; engine: 'gemini' | 'knowledge_base' }> {
    if (this.geminiKey.length <= 10) {
      return { content: kbFallback.content, engine: 'knowledge_base' };
    }

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        this.geminiModel,
      )}:generateContent?key=${encodeURIComponent(this.geminiKey)}`;

      const systemPrompt = [
        'You are I-Link AI, an assistant for a Philippine barangay community resilience platform.',
        'STRICT RULES:',
        '1. Use ONLY the verified barangay context provided below when stating fees, office hours, addresses, announcements, or procedures.',
        '2. Never invent official announcements, phone numbers, or government rules.',
        '3. If the user reports an immediate life-threatening emergency, tell them to call 911 / BFP 160 / PNP 117 immediately and submit an I-Link Emergency report.',
        '4. Keep answers concise, clear, and well-structured with bullet points.',
        '',
        'VERIFIED CONTEXT:',
        kbFallback.content,
      ].join('\n');

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\nResident question: ${userMessage}` }],
            },
          ],
          generationConfig: { temperature: 0.2, maxOutputTokens: 700 },
        }),
      });

      if (!res.ok) {
        this.logger.warn(`Gemini API returned ${res.status}; falling back to verified knowledge base`);
        return { content: kbFallback.content, engine: 'knowledge_base' };
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) {
        return { content: kbFallback.content, engine: 'knowledge_base' };
      }
      return { content: text, engine: 'gemini' };
    } catch (err) {
      this.logger.warn(`Gemini request failed (${(err as Error)?.message}); using knowledge base`);
      return { content: kbFallback.content, engine: 'knowledge_base' };
    }
  }

  async chat(user: AuthUser, dto: ChatRequestDto) {
    let conversationId = dto.conversationId;
    if (conversationId) {
      const existing = unwrapOne(
        await this.supabase.admin
          .from('ai_conversations')
          .select('*')
          .eq('id', conversationId)
          .single(),
        'Conversation',
      );
      if (existing.user_id !== user.id) {
        throw new ForbiddenException('You do not have access to this conversation');
      }
    } else {
      const title = dto.message.trim().slice(0, 70);
      const createdConv = unwrap(
        await this.supabase.admin
          .from('ai_conversations')
          .insert({ user_id: user.id, title })
          .select('*')
          .single(),
        'Failed to start AI conversation',
      );
      conversationId = createdConv.id;
    }

    const userMsg = unwrap(
      await this.supabase.admin
        .from('ai_messages')
        .insert({
          conversation_id: conversationId,
          role: 'user',
          content: dto.message.trim(),
          engine: null,
          sources: [],
          suggested_actions: [],
        })
        .select('*')
        .single(),
      'Failed to save user message',
    );

    const ctx = await this.retrieveContext(dto.message);
    const kbReply = this.composeKnowledgeBaseReply(dto.message, ctx);
    const finalReply = await this.tryGeminiReply(dto.message, kbReply);
    const suggestedActions = this.buildSuggestedActions(dto.message);

    const assistantMsg = unwrap(
      await this.supabase.admin
        .from('ai_messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: finalReply.content,
          engine: finalReply.engine,
          sources: kbReply.sources,
          suggested_actions: suggestedActions,
        })
        .select('*')
        .single(),
      'Failed to save assistant response',
    );

    await this.supabase.admin
      .from('ai_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return {
      conversation_id: conversationId,
      user_message: userMsg,
      assistant_message: assistantMsg,
    };
  }
}

@Controller('ai')
export class AiChatController {
  constructor(private readonly ai: AiChatService) {}

  @Get('status')
  status() {
    return this.ai.status();
  }

  @Get('conversations')
  listConversations(@CurrentUser() user: AuthUser) {
    return this.ai.listConversations(user.id);
  }

  @Get('conversations/:id/messages')
  listMessages(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ai.listMessages(user, id);
  }

  @Post('chat')
  chat(@CurrentUser() user: AuthUser, @Body() dto: ChatRequestDto) {
    return this.ai.chat(user, dto);
  }

  @Delete('conversations/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ai.deleteConversation(user, id);
  }
}

@Module({
  controllers: [AiChatController],
  providers: [AiChatService],
  exports: [AiChatService],
})
export class AiChatModule {}
