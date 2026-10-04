/** Calls to outside services: Gemini, Open-Meteo, Google Places photos. */

import { AiPlan, City, PLAN_SCHEMA, Weather } from "./planner";

const CITY_COORDS: Record<City, [number, number]> = {
  cairo: [30.0444, 31.2357],
  giza: [30.0131, 31.2089],
  alexandria: [31.2001, 29.9187],
};

/** Today's real forecast from Open-Meteo (free, no key). Null if unavailable. */
export async function fetchWeather(city: City): Promise<Weather | null> {
  const [lat, lng] = CITY_COORDS[city];
  const url = "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${lat}&longitude=${lng}` +
    "&daily=temperature_2m_max,precipitation_probability_max" +
    "&timezone=Africa%2FCairo&forecast_days=1";
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const body = await res.json() as {
      daily?: { temperature_2m_max?: number[]; precipitation_probability_max?: number[] };
    };
    const maxTempC = body.daily?.temperature_2m_max?.[0];
    const rain = body.daily?.precipitation_probability_max?.[0];
    if (typeof maxTempC !== "number") return null;
    return { maxTempC, rainChancePct: typeof rain === "number" ? rain : 0 };
  } catch {
    return null;
  }
}

export class AiError extends Error {}

/** Asks Gemini for a plan as structured JSON. */
export async function askGemini(
  prompt: string,
  apiKey: string,
  model: string,
): Promise<AiPlan> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(40000),
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: PLAN_SCHEMA,
        temperature: 0.8,
      },
    }),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 500);
    throw new AiError(`Gemini HTTP ${res.status}: ${detail}`);
  }
  const body = await res.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  try {
    return JSON.parse(text) as AiPlan;
  } catch {
    throw new AiError(`Gemini returned non-JSON: ${text.slice(0, 200)}`);
  }
}

/** Turns a Google Places photo reference into a viewable link. */
export async function resolvePhotoUri(
  photoName: string,
  apiKey: string,
): Promise<string | null> {
  if (!/^places\/[^/]+\/photos\/[^/]+$/.test(photoName)) return null;
  const url = `https://places.googleapis.com/v1/${photoName}/media` +
    "?maxWidthPx=900&skipHttpRedirect=true";
  try {
    const res = await fetch(url, {
      headers: { "X-Goog-Api-Key": apiKey },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`Places photo HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return null;
    }
    const body = await res.json() as { photoUri?: string };
    return body.photoUri ?? null;
  } catch (e) {
    console.warn("Places photo failed", e);
    return null;
  }
}
