import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser, checkRateLimit } from "./_lib/utils";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  const allowed = await checkRateLimit(user.id);
  if (!allowed) {
    return res.status(429).json({ error: "Rate limit reached. Try again later." });
  }

  try {
    const { icao = "EGLL" } = req.body || {};
    const cachedKey = icao.trim().toUpperCase();

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const admin = createClient(supabaseUrl as string, supabaseKey as string);

    const { data: cacheRow } = await admin
      .from('weather_cache')
      .select('*')
      .eq('icao', cachedKey)
      .single();

    const CACHE_DURATION = 45 * 60 * 1000; // 45 minutes
    const now = Date.now();

    if (cacheRow && (now - new Date(cacheRow.updated_at).getTime() < CACHE_DURATION)) {
      return res.status(200).json(cacheRow.data);
    }

    const url = `https://aviationweather.gov/api/data/metar?ids=${cachedKey}&format=json`;
    const noaaRes = await fetch(url);
    if (!noaaRes.ok) throw new Error("NOAA API failed");
    const metarData = await noaaRes.json();

    if (!metarData || metarData.length === 0) {
      throw new Error(`No METAR found for ${cachedKey}`);
    }

    const metar = metarData[0];

    const wdir = metar.wdir === 'VRB' ? 'Variable' : (metar.wdir ? `${metar.wdir}°` : '');
    const wspd = metar.wspd ? `${metar.wspd}kt` : '';
    const wind = wdir && wspd ? `Wind ${wdir} at ${wspd}` : '';
    const vis = metar.visib ? `Vis ${metar.visib}sm` : '';
    const temp = (metar.temp !== null && metar.temp !== undefined) ? `Temp ${metar.temp}°C` : '';
    const clouds = metar.clouds ? metar.clouds.map((c: any) => c.cover).join('/') : '';

    const briefingParts = [wind, vis, temp, clouds].filter(Boolean);
    const briefing = `METAR for ${cachedKey}: ${briefingParts.join(', ')}.`;

    let condition = "SUNNY";
    if (metar.wxString && metar.wxString.includes("TS")) condition = "STORM";
    else if (metar.wxString && (metar.wxString.includes("RA") || metar.wxString.includes("DZ"))) condition = "RAIN";
    else if (metar.wxString && metar.wxString.includes("SN")) condition = "SNOW";
    else if (metar.wxString && (metar.wxString.includes("BR") || metar.wxString.includes("FG"))) condition = "FOG";
    else if (wspd && parseInt(metar.wspd) > 20) condition = "WINDY";
    else if (metar.clouds && metar.clouds.some((c: any) => ['BKN', 'OVC'].includes(c.cover))) condition = "CLOUDY";

    const finalData = {
      briefing,
      condition,
      forecast: []
    };

    await admin.from('weather_cache').upsert({
      icao: cachedKey,
      data: finalData,
      updated_at: new Date().toISOString()
    }, { onConflict: 'icao' });

    return res.status(200).json(finalData);
  } catch (e) {
    console.error("Error in weather handler:", e);
    return res.status(500).json({ error: "Failed to fetch weather." });
  }
}
