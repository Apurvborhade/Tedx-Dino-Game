// ════════════════════════════════════════════════════════════════════════════
// submit-score Edge Function (Deno / Supabase Edge Runtime)
// ════════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROFANITY_LIST = [
  'ASS', 'BITCH', 'COCK', 'CUNT', 'DICK', 'FUCK', 'NIGGER', 'NIGGA', 'PENIS', 'PISS', 'PUSSY', 'SHIT', 'SLUT', 'TWAT', 'WHORE'
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { name, score, token } = await req.json();

    // 1. Basic type & presence checks
    if (!name || typeof name !== 'string' || typeof score !== 'number') {
      return new Response(JSON.stringify({ error: 'Invalid payload parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Instagram handles: lowercase, 2-30 chars of a-z 0-9 . _ , no leading or
    // trailing dot and no two dots in a row. Mirrors src/net/handle.ts — this
    // file cannot import it, so keep the two in step.
    const cleanName = name.trim().toLowerCase().replace(/^@+/, '');

    // 2. Handle validation
    const handleOk =
      cleanName.length >= 2 && cleanName.length <= 30 &&
      /^[a-z0-9._]+$/.test(cleanName) &&
      !cleanName.startsWith('.') && !cleanName.endsWith('.') &&
      !cleanName.includes('..');
    if (!handleOk) {
      return new Response(JSON.stringify({ error: 'Instagram handle must be 2-30 characters of letters, numbers, . or _' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Profanity check
    const upperName = cleanName.toUpperCase();
    for (const bad of PROFANITY_LIST) {
      if (upperName.includes(bad)) {
        return new Response(JSON.stringify({ error: 'Inappropriate handle' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 4. Score range check
    if (score < 0 || score > 999999 || !Number.isInteger(score)) {
      return new Response(JSON.stringify({ error: 'Score out of valid range' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Plausibility check against run duration
    const durationMs = token?.durationMs ?? 1000;
    // Theoretical top speed is SPEED.SURGE_MAX = 860 px/s (680 base + 80 hard
    // mode, then the late-game surge, capped). 1 px = 0.025 score units →
    // 21.5 score/s at the cap. Allow 23/s + slack.
    // NOTE: keep in step with SPEED.SURGE_MAX in src/config.ts.
    const maxTheoreticalScore = Math.ceil((durationMs / 1000) * 23) + 50;
    if (score > maxTheoreticalScore && score > 200) {
      return new Response(JSON.stringify({ error: 'Score violates physical trajectory bounds' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6. Connect to Supabase DB via Service Role
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: insertError } = await supabase.from('scores').insert({
      name: cleanName,
      score,
      duration_ms: durationMs,
      jump_count: token?.jumpCount ?? 0,
    });

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Database insert failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 7. Calculate Rank
    const { count } = await supabase
      .from('scores')
      .select('*', { count: 'exact', head: true })
      .gt('score', score);

    const rank = (count ?? 0) + 1;

    return new Response(
      JSON.stringify({
        success: true,
        rank,
        isTop10: rank <= 10,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
