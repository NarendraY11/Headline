import {
    Cloud,
    CloudFog,
    CloudLightning,
    CloudOff,
    CloudRain,
    Snowflake,
    Sun,
    Wind,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useGlobalLoading } from "../../contexts/LoadingContext";
import { apiFetch } from "../../lib/api";

export function WeatherWidget() {
  const { user } = useAuth();
  const [weatherData, setWeatherData] = useState<{
    briefing: string;
    condition: string;
    forecast?: any[];
    unavailable?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const { setLoading: setGlobalLoading } = useGlobalLoading();

  const fetchWeather = async () => {
    if (!user) {
      setWeatherData({
        briefing: "Sign in to see weather briefing",
        condition: "CLOUDY",
        unavailable: true,
      });
      setLoading(false);
      setGlobalLoading(false);
      return;
    }
    setLoading(true);
    setGlobalLoading(true);

    try {
      const response = await apiFetch("/api/weather", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ icao: "EGLL" }),
      });

      if (!response) {
        setWeatherData((prev) => ({ 
          briefing: "Weather briefing is currently offline", 
          condition: "CLOUDY", 
          unavailable: true 
        }) as any);
        return;
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        try {
          const d = await response.json();
          if (d && d.briefing) {
            setWeatherData({
              ...d,
              unavailable: false,
              forecast: Array.isArray(d.forecast) ? d.forecast : [],
            });
          } else {
            setWeatherData((prev) => ({ 
              briefing: "Weather briefing is currently offline", 
              condition: "CLOUDY", 
              unavailable: true 
            }) as any);
          }
        } catch (jsonError) {
          setWeatherData((prev) => ({ 
            briefing: "Weather briefing is currently offline", 
            condition: "CLOUDY", 
            unavailable: true 
          }) as any);
        }
      } else {
        setWeatherData((prev) => ({ 
          briefing: "Weather briefing is currently offline", 
          condition: "CLOUDY", 
          unavailable: true 
        }) as any);
      }
    } catch (error) {
      setWeatherData((prev) => ({ 
        briefing: "Weather briefing is currently offline", 
        condition: "CLOUDY", 
        unavailable: true 
      }) as any);
    } finally {
      setLoading(false);
      setGlobalLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
  }, [user]);

  const getWeatherIcon = (condition: string, size: number = 24) => {
    switch (condition) {
      case "SUNNY":
        return <Sun size={size} className="text-amber" />;
      case "CLOUDY":
        return <Cloud size={size} className="text-muted" />;
      case "RAIN":
        return <CloudRain size={size} className="text-sky" />;
      case "STORM":
        return <CloudLightning size={size} className="text-signal" />;
      case "SNOW":
        return <Snowflake size={size} className="text-sky" />;
      case "WINDY":
        return <Wind size={size} className="text-muted" />;
      case "FOG":
        return <CloudFog size={size} className="text-muted" />;
      default:
        return <Sun size={size} className="text-amber" />;
    }
  };

  const isAlert =
    weatherData?.condition === "STORM" || weatherData?.condition === "RAIN";

  if (!user) {
    return (
      <div
        className="bg-paper border border-rule rounded-2xl md:rounded-lg shadow-sm col-span-1 flex items-center justify-between"
        style={{ padding: "14px 20px", minHeight: "52px" }}
      >
        <div className="flex items-center gap-2 md:gap-3 shrink-0 mr-2">
          <CloudOff size={16} className="text-muted shrink-0" />
          <span className="font-sans text-[14px] text-ink font-normal truncate">
            Sign in to use AI coaching
          </span>
          <span className="text-muted-2 shrink-0">·</span>
          <span className="font-mono text-[11px] text-muted-2 uppercase tracking-wide truncate hidden sm:inline">
            Aviation weather briefing requires active login
          </span>
        </div>
      </div>
    );
  }

  if (weatherData?.unavailable) {
    return (
      <div
        className="bg-paper border border-rule rounded-2xl md:rounded-lg shadow-sm col-span-1 flex items-center justify-between"
        style={{ padding: "14px 20px", minHeight: "52px" }}
      >
        <div className="flex items-center gap-2 md:gap-3 shrink-0 mr-2">
          <CloudOff size={16} className="text-muted shrink-0" />
          <span className="font-sans text-[14px] text-ink font-normal truncate">
            WX Data Offline
          </span>
          <span className="text-muted-2 shrink-0">·</span>
          <span className="font-mono text-[11px] text-muted-2 uppercase tracking-wide truncate hidden sm:inline">
            METAR feed unavailable
          </span>
        </div>
        <button
          onClick={fetchWeather}
          disabled={loading}
          className="flex items-center justify-center border border-rule rounded-full px-4 font-sans text-[11px] font-medium text-ink hover:bg-rule/30 transition-colors disabled:opacity-50 h-[32px] shrink-0"
        >
          {loading ? "Retrying..." : "Retry"}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-paper border border-rule rounded-2xl md:rounded-lg p-5 md:p-4 shadow-sm col-span-1 flex flex-col justify-between transition-all duration-300">
      <div className="flex justify-between items-center mb-2">
        <div className="font-mono text-[9px] text-muted-2 tracking-widest uppercase flex items-center gap-2">
          <span>WX INFO</span>
          {isAlert && <span className="w-1.5 h-1.5 rounded-full bg-signal" />}
        </div>
        <div
          className={`w-1.5 h-1.5 rounded-sm transform rotate-45 ${loading && !weatherData?.unavailable ? "bg-signal animate-pulse" : "bg-signal"}`}
          title="Live WX Data"
        />
      </div>
      <div>
        {loading && !weatherData ? (
          <div className="h-6 flex items-center">
            <div className="w-4 h-4 rounded-full border-t-2 border-navy animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              {weatherData?.condition && (
                <div role="button" tabIndex={0} onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
                  className="mt-1 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setExpanded(!expanded)}
                  title="Click to toggle forecast"
                >
                  {getWeatherIcon(weatherData.condition)}
                </div>
              )}
              <p className="font-sans text-sm text-ink-2">
                {weatherData?.briefing}
              </p>
            </div>
            {expanded && weatherData?.forecast && (
              <div className="mt-2 pt-4 border-t border-rule grid grid-cols-3 xs:grid-cols-6 sm:grid-cols-6 gap-2.5 sm:gap-2">
                {weatherData.forecast.map((f: any, i: number) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <span className="font-mono text-[9px] text-muted-2">
                      {f.hour}
                    </span>
                    {getWeatherIcon(f.condition, 14)}
                    <span className="font-sans text-[10px] text-ink font-semibold">
                      {f.temp}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
