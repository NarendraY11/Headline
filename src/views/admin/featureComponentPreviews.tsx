import { Bell, Bookmark, CalendarDays, Moon, Search, ShieldAlert, Smartphone, Sun, Users, Wind } from "lucide-react";
import { useFeature } from "../../hooks/useFeatureFlags";
import { previewAnalyticsService, previewMockData } from "../../preview/services";

interface PreviewScaffoldProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

function PreviewScaffold({ title, subtitle, children }: PreviewScaffoldProps) {
  return (
    <div className="bg-[#f6f1e6] p-4 md:p-5 min-h-[320px]">
      <div className="rounded-[18px] border border-[#0f1e3c]/12 bg-[#fffdf8] shadow-[0_18px_42px_rgba(15,30,60,0.08)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#0f1e3c]/10 bg-[#f3eee2]">
          <h4 className="font-serif text-[18px] text-[#0f1e3c]">{title}</h4>
          <p className="mt-1 text-[11px] leading-relaxed text-[#6b7280]">{subtitle}</p>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function PreviewViewport({
  banner,
  toolbarRight,
  children,
}: {
  banner?: React.ReactNode;
  toolbarRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[16px] border border-[#0f1e3c]/10 overflow-hidden bg-white">
      {banner}
      <div className="px-4 py-3 border-b border-[#0f1e3c]/8 bg-[#fcfaf4] flex items-center justify-between gap-3">
        <div>
          <div className="font-serif text-[18px] text-[#0f1e3c]">Heading</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#8a8f99]">Preview Workspace</div>
        </div>
        {toolbarRight}
      </div>
      <div className="p-4 bg-[linear-gradient(180deg,#fffdf8_0%,#f7f1e6_100%)]">{children}</div>
    </div>
  );
}

function FlagStateBadge({ active, activeLabel, inactiveLabel }: { active: boolean; activeLabel: string; inactiveLabel: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.16em] ${
        active
          ? "bg-emerald-100 text-emerald-700"
          : "bg-slate-200 text-slate-600"
      }`}
    >
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

function InfoCard({
  title,
  body,
  tone = "default",
}: {
  title: string;
  body: string;
  tone?: "default" | "muted" | "warning";
}) {
  const toneClass =
    tone === "warning"
      ? "bg-amber-50 border-amber-200 text-amber-800"
      : tone === "muted"
      ? "bg-slate-50 border-slate-200 text-slate-700"
      : "bg-white border-[#0f1e3c]/10 text-[#334155]";

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="font-sans text-[13px] font-semibold">{title}</div>
      <p className="mt-1 text-[12px] leading-relaxed">{body}</p>
    </div>
  );
}

function ToggleChip({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[#0f1e3c]/10 bg-white px-3 py-1.5">
      <span className="text-[11px] font-medium text-[#0f1e3c]">{label}</span>
      <span className={`relative h-5 w-9 rounded-full ${enabled ? "bg-emerald-600" : "bg-slate-300"}`}>
        <span
          className={`absolute top-[2px] h-4 w-4 rounded-full bg-white transition-all ${
            enabled ? "left-[18px]" : "left-[2px]"
          }`}
        />
      </span>
    </div>
  );
}

function MetricGrid({
  items,
}: {
  items: Array<{ label: string; value: string; delta?: string; tone?: "positive" | "neutral" | "warning" }>;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-[#0f1e3c]/10 bg-white p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#8a8f99]">{item.label}</div>
          <div className="mt-2 font-serif text-[22px] text-[#0f1e3c]">{item.value}</div>
          {item.delta ? (
            <div
              className={`mt-1 text-[11px] ${
                item.tone === "positive"
                  ? "text-emerald-700"
                  : item.tone === "warning"
                  ? "text-amber-700"
                  : "text-slate-500"
              }`}
            >
              {item.delta}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function DisabledOverlay({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-slate-300 bg-slate-100/80 p-5 text-center">
      <div className="font-serif text-[20px] text-slate-700">{title}</div>
      <p className="mt-2 text-[12px] leading-relaxed text-slate-500">{body}</p>
    </div>
  );
}

export function AnnouncementBannerPreview() {
  const bannerEnabled = useFeature("announcementBanner");
  const announcementText = useFeature("announcementText");

  return (
    <PreviewScaffold
      title="Announcement Banner"
      subtitle="This preview uses the unsaved draft flags and announcement copy from the current admin session."
    >
      <PreviewViewport
        banner={
          bannerEnabled ? (
            <div className="bg-indigo-600 px-4 py-2 text-center text-[11px] font-medium text-white">
              {announcementText || "Welcome to our platform!"}
            </div>
          ) : undefined
        }
        toolbarRight={<FlagStateBadge active={bannerEnabled} activeLabel="Visible" inactiveLabel="Hidden" />}
      >
        <div className="space-y-3">
          <InfoCard
            title={bannerEnabled ? "Banner is live in draft mode" : "Banner is hidden in draft mode"}
            body={
              bannerEnabled
                ? "The top site-wide announcement is currently visible and will use the unsaved text shown above."
                : "The banner area collapses completely when the draft flag is off."
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <InfoCard title="Hero Module" body="Main content starts below the top bar." tone="muted" />
            <InfoCard title="Secondary Module" body="No route or network calls are needed for this preview." tone="muted" />
          </div>
        </div>
      </PreviewViewport>
    </PreviewScaffold>
  );
}

export function MaintenanceModePreview() {
  const maintenanceMode = useFeature("maintenanceMode");

  return (
    <PreviewScaffold
      title="Maintenance Mode"
      subtitle="Shows how the global lockout layer behaves for non-admin users when the draft flag changes."
    >
      <div className="relative rounded-[16px] border border-[#0f1e3c]/10 overflow-hidden bg-white min-h-[260px]">
        <div className="px-4 py-3 border-b border-[#0f1e3c]/8 bg-[#fcfaf4] flex items-center justify-between">
          <div className="font-serif text-[18px] text-[#0f1e3c]">Student Terminal</div>
          <FlagStateBadge active={maintenanceMode} activeLabel="Lockout On" inactiveLabel="Lockout Off" />
        </div>
        <div className="p-4 grid grid-cols-2 gap-3 bg-[linear-gradient(180deg,#fffdf8_0%,#f7f1e6_100%)]">
          <InfoCard title="Today Dashboard" body="Primary learning widgets and streak panels." tone="muted" />
          <InfoCard title="Quiz Launcher" body="Entry point for practice and mock sessions." tone="muted" />
          <InfoCard title="Analytics" body="Progress charts and diagnosis modules." tone="muted" />
          <InfoCard title="Study Schedule" body="Plan and calendar surfaces." tone="muted" />
        </div>

        {maintenanceMode && (
          <div className="absolute inset-0 bg-[#f7f4ec]/92 backdrop-blur-[3px] flex items-center justify-center p-6">
            <div className="max-w-xs rounded-[20px] border border-[#0f1e3c]/12 bg-[#fffdf8] p-6 text-center shadow-[0_24px_50px_rgba(15,30,60,0.16)]">
              <ShieldAlert size={28} className="mx-auto text-[#0f1e3c]" />
              <h4 className="mt-3 font-serif text-[22px] text-[#0f1e3c]">Scheduled Maintenance</h4>
              <p className="mt-2 text-[12px] leading-relaxed text-[#6b7280]">
                Non-admin users are blocked behind the maintenance overlay until the draft flag is turned off.
              </p>
            </div>
          </div>
        )}
      </div>
    </PreviewScaffold>
  );
}

export function SignupsOpenPreview() {
  const signupsOpen = useFeature("signupsOpen");

  return (
    <PreviewScaffold
      title="Signups Open"
      subtitle="Mirrors the auth surface state without opening the real auth modal or touching any backend."
    >
      <PreviewViewport toolbarRight={<FlagStateBadge active={signupsOpen} activeLabel="Signups On" inactiveLabel="Signups Off" />}>
        <div className="mx-auto max-w-sm rounded-[20px] border border-[#0f1e3c]/10 bg-white p-5 shadow-[0_16px_36px_rgba(15,30,60,0.08)]">
          <div className="font-serif text-[22px] text-[#0f1e3c]">Auth Modal</div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[#8a8f99]">Preview Only</div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-full bg-[#0f1e3c] px-3 py-2 text-center text-[11px] font-semibold text-white">Sign In</div>
            <div
              className={`rounded-full px-3 py-2 text-center text-[11px] font-semibold ${
                signupsOpen
                  ? "border border-[#0f1e3c]/12 bg-[#f8f4ea] text-[#0f1e3c]"
                  : "border border-slate-200 bg-slate-100 text-slate-400"
              }`}
            >
              Sign Up
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-10 rounded-xl border border-[#0f1e3c]/10 bg-[#fcfaf4]" />
            <div className="h-10 rounded-xl border border-[#0f1e3c]/10 bg-[#fcfaf4]" />
          </div>
          <InfoCard
            title={signupsOpen ? "New account creation is available" : "New account creation is blocked"}
            body={
              signupsOpen
                ? "The sign-up tab stays interactive and the auth surface invites new users to register."
                : "The sign-up tab appears disabled so admins can preview the closed-enrollment state before saving."
            }
            tone={signupsOpen ? "default" : "warning"}
          />
        </div>
      </PreviewViewport>
    </PreviewScaffold>
  );
}

export function CookieConsentPreview() {
  const cookieConsent = useFeature("cookieConsent");

  return (
    <PreviewScaffold
      title="Cookie Consent"
      subtitle="Shows the consent banner presentation without reading or writing local storage."
    >
      <PreviewViewport toolbarRight={<FlagStateBadge active={cookieConsent} activeLabel="Banner On" inactiveLabel="Banner Off" />}>
        <div className="rounded-[18px] border border-[#0f1e3c]/10 bg-white/80 p-4 min-h-[180px]">
          <div className="font-serif text-[20px] text-[#0f1e3c]">Landing Experience</div>
          <p className="mt-2 text-[12px] leading-relaxed text-[#6b7280]">
            The page body remains visible while a consent banner may appear over the lower edge.
          </p>
        </div>

        {cookieConsent ? (
          <div className="mt-4 rounded-[18px] border border-[#0f1e3c]/12 bg-[#fffdf8] p-4 shadow-[0_14px_32px_rgba(15,30,60,0.08)]">
            <div className="font-serif text-[18px] text-[#0f1e3c]">Consent Settings</div>
            <p className="mt-2 text-[12px] leading-relaxed text-[#6b7280]">
              We employ cookie identifiers to personalize experience and analyze product usage.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <div className="rounded-xl bg-[#0f1e3c] px-4 py-2 text-[11px] font-semibold text-white">Accept</div>
              <div className="rounded-xl border border-[#0f1e3c]/12 px-4 py-2 text-[11px] font-semibold text-[#0f1e3c]">Decline</div>
            </div>
          </div>
        ) : (
          <InfoCard
            title="Consent banner is hidden"
            body="The surface previews the uncluttered layout users see when the draft flag is off."
            tone="muted"
          />
        )}
      </PreviewViewport>
    </PreviewScaffold>
  );
}

export function ThemeTogglePreview() {
  const themeToggle = useFeature("themeToggle");

  return (
    <PreviewScaffold
      title="Theme Toggle"
      subtitle="Previews whether the quick theme switch appears in the app chrome. The palette itself stays stable in this safe mock."
    >
      <PreviewViewport
        toolbarRight={
          <div className="flex items-center gap-2">
            {themeToggle ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0f1e3c]/10 bg-white px-3 py-1.5">
                <Moon size={14} className="text-[#0f1e3c]" />
                <Sun size={14} className="text-[#d97706]" />
              </div>
            ) : (
              <FlagStateBadge active={false} activeLabel="Visible" inactiveLabel="Toggle Hidden" />
            )}
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <InfoCard title="Header Actions" body={themeToggle ? "Theme switch remains available in the toolbar." : "Theme switch is removed from the toolbar."} />
            <InfoCard title="User Flow" body="No real theme mutation happens in preview mode." tone="muted" />
          </div>
          <div className="rounded-[18px] border border-[#0f1e3c]/10 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-serif text-[18px] text-[#0f1e3c]">Preview Header</div>
                <p className="mt-1 text-[12px] text-[#6b7280]">Visual presence of the theme control updates with the unsaved draft state.</p>
              </div>
              {themeToggle ? <ToggleChip label="Theme Toggle" enabled /> : null}
            </div>
          </div>
        </div>
      </PreviewViewport>
    </PreviewScaffold>
  );
}

export function NotificationsPreview() {
  const notifications = useFeature("notifications");
  const notificationItems = previewMockData.notifications;
  const unreadCount = previewMockData.notifications.filter((n) => n.unread).length;

  return (
    <PreviewScaffold
      title="Notifications"
      subtitle="Service source: previewNotificationService. Shows the notification center without subscribing to real channels or requesting permissions."
    >
      <PreviewViewport
        toolbarRight={
          notifications ? (
            <div className="relative rounded-full border border-[#0f1e3c]/10 bg-white p-2">
              <Bell size={16} className="text-[#0f1e3c]" />
              <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                {unreadCount}
              </span>
            </div>
          ) : (
            <FlagStateBadge active={false} activeLabel="Visible" inactiveLabel="Bell Hidden" />
          )
        }
      >
        {notifications ? (
          <div className="space-y-3">
            <InfoCard title="Notification bell is visible" body="The top-bar action remains available and unread counts update from previewNotificationService mock payloads." />
            <div className="rounded-[18px] border border-[#0f1e3c]/10 bg-white p-4 space-y-3">
              <div className="font-serif text-[18px] text-[#0f1e3c]">Recent Notifications</div>
              {notificationItems.map((item) => (
                <InfoCard key={item.id} title={item.title} body={`${item.body} • ${item.timestampLabel}`} tone={item.unread ? "default" : "muted"} />
              ))}
            </div>
          </div>
        ) : (
          <InfoCard
            title="Notification entry point is hidden"
            body="The bell and unread surface disappear entirely when the draft flag is off."
            tone="muted"
          />
        )}
      </PreviewViewport>
    </PreviewScaffold>
  );
}

export function WeatherBriefingPreview() {
  const weatherBriefing = useFeature("weatherBriefing");
  const briefing = previewMockData.weatherBriefing;

  return (
    <PreviewScaffold
      title="Weather Briefing"
      subtitle="Service source: previewWeatherService. Shows a static aviation weather summary and METAR-style sample without any weather API calls."
    >
      <PreviewViewport toolbarRight={<FlagStateBadge active={weatherBriefing} activeLabel="Briefing On" inactiveLabel="Briefing Off" />}>
        {weatherBriefing ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#0f1e3c]/10 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-serif text-[22px] text-[#0f1e3c]">{briefing.station}</div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-[#6b7280]">{briefing.issuedAt}</div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.16em] text-sky-700">
                  <Wind size={12} />
                  {briefing.flightCategory}
                </div>
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-[#6b7280]">{briefing.summary}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InfoCard title="Wind" body={briefing.wind} tone="muted" />
              <InfoCard title="Visibility" body={briefing.visibility} tone="muted" />
              <InfoCard title="Ceiling" body={briefing.ceiling} tone="muted" />
              <InfoCard title="Hazards" body={briefing.hazards.join(", ")} tone="warning" />
            </div>
            <div className="rounded-2xl border border-[#0f1e3c]/10 bg-[#0f1e3c] p-4 text-white">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/70">METAR-style sample</div>
              <div className="mt-3 font-mono text-[12px] leading-6">
                {briefing.station} {briefing.issuedAt} {briefing.wind} {briefing.visibility} {briefing.ceiling}
              </div>
            </div>
          </div>
        ) : (
          <DisabledOverlay
            title="Weather summary is hidden"
            body="The aviation weather card, coded briefing line, and hazard summary are removed from the workspace when the draft flag is off."
          />
        )}
      </PreviewViewport>
    </PreviewScaffold>
  );
}

export function PushNotificationsPreview() {
  const pushNotifications = useFeature("pushNotifications");
  const subscription = previewMockData.pushSubscriptionStatus;
  const pushExamples = previewMockData.pushExamples;

  return (
    <PreviewScaffold
      title="Push Notifications"
      subtitle="Service source: previewNotificationService. Simulates browser/device push messaging without requesting permission or registering a service worker."
    >
      <PreviewViewport toolbarRight={<FlagStateBadge active={pushNotifications} activeLabel="Push On" inactiveLabel="Push Off" />}>
        {pushNotifications ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#0f1e3c]/10 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-serif text-[20px] text-[#0f1e3c]">{subscription.channelLabel}</div>
                  <p className="mt-1 text-[12px] text-[#6b7280]">{subscription.browserLabel} • {subscription.deviceLabel}</p>
                </div>
                <ToggleChip label="Subscribed" enabled={subscription.state === "subscribed"} />
              </div>
              <p className="mt-3 text-[12px] text-[#6b7280]">{subscription.lastSynced}</p>
            </div>
            <div className="space-y-3">
              {pushExamples.map((example) => (
                <div key={example.id} className="rounded-2xl border border-[#0f1e3c]/10 bg-white p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-[#0f1e3c] p-2 text-white">
                      <Smartphone size={15} />
                    </div>
                    <div>
                      <div className="font-serif text-[17px] text-[#0f1e3c]">{example.title}</div>
                      <p className="mt-1 text-[12px] leading-relaxed text-[#6b7280]">{example.body}</p>
                      <div className="mt-2 text-[10px] font-mono uppercase tracking-[0.16em] text-[#8a8f99]">
                        {example.device} • {example.deliveryLabel}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <DisabledOverlay
            title="Push delivery is inactive"
            body="Device examples, subscription status, and delivery cards stay hidden until the draft flag is enabled."
          />
        )}
      </PreviewViewport>
    </PreviewScaffold>
  );
}

export function CalendarSyncPreview() {
  const calendarSync = useFeature("calendarSync");
  const snapshot = previewMockData.calendarSyncSnapshot;

  return (
    <PreviewScaffold
      title="Calendar Sync"
      subtitle="Service source: previewNotificationService. Shows synced study sessions and export examples without touching Google Calendar or ICS generation."
    >
      <PreviewViewport toolbarRight={<FlagStateBadge active={calendarSync} activeLabel="Sync On" inactiveLabel="Sync Off" />}>
        {calendarSync ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#0f1e3c]/10 bg-white p-4">
              <div className="flex items-center gap-2">
                <CalendarDays size={16} className="text-[#0f1e3c]" />
                <div className="font-serif text-[20px] text-[#0f1e3c]">{snapshot.accountLabel}</div>
              </div>
              <p className="mt-2 text-[12px] text-[#6b7280]">{snapshot.statusLabel}</p>
            </div>
            <div className="space-y-3">
              {snapshot.upcoming.map((item) => (
                <div key={item.id} className="rounded-2xl border border-[#0f1e3c]/10 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-serif text-[17px] text-[#0f1e3c]">{item.title}</div>
                      <div className="mt-1 text-[12px] text-[#6b7280]">{item.dateLabel} • {item.timeLabel}</div>
                    </div>
                    <span className="rounded-full bg-[#f3eee2] px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-[#0f1e3c]">
                      {item.exportType}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-[#6b7280]">Export target: {item.calendarLabel}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <DisabledOverlay
            title="Calendar exports are hidden"
            body="Synced study sessions, export chips, and connected-calendar context are removed when the draft flag is off."
          />
        )}
      </PreviewViewport>
    </PreviewScaffold>
  );
}

export function PwaInstallPromptPreview() {
  const pwaInstallPrompt = useFeature("pwaInstallPrompt");

  return (
    <PreviewScaffold
      title="PWA Install Prompt"
      subtitle="Shows the install banner treatment without depending on browser install events."
    >
      <PreviewViewport toolbarRight={<FlagStateBadge active={pwaInstallPrompt} activeLabel="Prompt On" inactiveLabel="Prompt Off" />}>
        <div className="rounded-[18px] border border-[#0f1e3c]/10 bg-white/80 p-4 min-h-[170px]">
          <div className="font-serif text-[20px] text-[#0f1e3c]">Study Dashboard</div>
          <p className="mt-2 text-[12px] text-[#6b7280]">The install prompt floats above the product surface when enabled.</p>
        </div>

        {pwaInstallPrompt ? (
          <div className="mt-4 flex justify-end">
            <div className="max-w-[290px] rounded-[18px] border border-[#0f1e3c]/12 bg-[#fffdf8] p-4 shadow-[0_16px_34px_rgba(15,30,60,0.10)]">
              <div className="flex items-start gap-3">
                <div className="rounded-[14px] bg-[#0f1e3c] p-2 text-white">
                  <Smartphone size={16} />
                </div>
                <div>
                  <div className="font-serif text-[18px] text-[#0f1e3c]">Install Heading</div>
                  <p className="mt-1 text-[12px] leading-relaxed text-[#6b7280]">
                    Add the app to your home screen for faster access and offline study.
                  </p>
                  <div className="mt-3 inline-flex rounded-xl bg-[#0f1e3c] px-4 py-2 text-[11px] font-semibold text-white">
                    Install App
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <InfoCard
            title="Install prompt is hidden"
            body="The dashboard preview remains clean when the prompt flag is off."
            tone="muted"
          />
        )}
      </PreviewViewport>
    </PreviewScaffold>
  );
}

export function AnalyticsPreview() {
  const analytics = useFeature("analytics");
  const analyticsSummaries = previewAnalyticsService.getAnalyticsSummaries();

  return (
    <PreviewScaffold
      title="Analytics Dashboard"
      subtitle="Uses static progress summaries so admins can inspect the active and disabled states without loading live telemetry."
    >
      <PreviewViewport toolbarRight={<FlagStateBadge active={analytics} activeLabel="Analytics On" inactiveLabel="Analytics Off" />}>
        {analytics ? (
          <div className="space-y-4">
            <MetricGrid items={analyticsSummaries} />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <InfoCard title="Progress diagnosis" body="Top focus this week: convert meteorology review sessions into timed drill attempts." />
              <InfoCard title="Study momentum" body="Three of four core papers are trending upward in the current mock snapshot." tone="muted" />
            </div>
          </div>
        ) : (
          <DisabledOverlay
            title="Analytics route is locked"
            body="Performance charts, weekly summaries, and diagnosis cards are hidden from the student workspace when this draft flag is off."
          />
        )}
      </PreviewViewport>
    </PreviewScaffold>
  );
}

export function MasteryChartsPreview() {
  const masteryCharts = useFeature("masteryCharts");
  const masteryChartSeries = previewAnalyticsService.getMasteryChartSeries();

  return (
    <PreviewScaffold
      title="Mastery Charts"
      subtitle="Previews subject mastery cards and chart-like progress bars using reusable static study data."
    >
      <PreviewViewport toolbarRight={<FlagStateBadge active={masteryCharts} activeLabel="Charts On" inactiveLabel="Charts Off" />}>
        {masteryCharts ? (
          <div className="space-y-3">
            {masteryChartSeries.map((item) => (
              <div key={item.subject} className="rounded-2xl border border-[#0f1e3c]/10 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-serif text-[18px] text-[#0f1e3c]">{item.subject}</div>
                    <div className="text-[11px] text-[#6b7280]">Mastery trend {item.trend}</div>
                  </div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-emerald-700">
                    {item.mastery}%
                  </div>
                </div>
                <div className="mt-3 h-3 rounded-full bg-[#e8edf5]">
                  <div className="h-3 rounded-full bg-[#0f1e3c]" style={{ width: `${item.mastery}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <DisabledOverlay
            title="Mastery visualizations are hidden"
            body="Students still see the broader surface, but mastery bars and progress comparisons are removed when the draft flag is off."
          />
        )}
      </PreviewViewport>
    </PreviewScaffold>
  );
}

export function LeaderboardPreview() {
  const leaderboard = useFeature("leaderboard");
  const leaderboardRankings = previewAnalyticsService.getLeaderboardRankings();

  return (
    <PreviewScaffold
      title="Leaderboard"
      subtitle="Simulates the competitive rankings panel with static standings and a realistic disabled beta state."
    >
      <PreviewViewport toolbarRight={<FlagStateBadge active={leaderboard} activeLabel="Leaderboard On" inactiveLabel="Leaderboard Off" />}>
        {leaderboard ? (
          <div className="space-y-3">
            {leaderboardRankings.map((entry) => (
              <div
                key={`${entry.rank}-${entry.name}`}
                className={`flex items-center justify-between rounded-2xl border p-4 ${
                  entry.currentUser ? "border-amber-300 bg-amber-50" : "border-[#0f1e3c]/10 bg-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0f1e3c] text-[12px] font-bold text-white">
                    {entry.rank}
                  </div>
                  <div>
                    <div className="font-serif text-[18px] text-[#0f1e3c]">{entry.name}</div>
                    <div className="text-[11px] text-[#6b7280]">{entry.streak}</div>
                  </div>
                </div>
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#0f1e3c]">{entry.score}</div>
              </div>
            ))}
          </div>
        ) : (
          <DisabledOverlay
            title="Leaderboard beta is hidden"
            body="Competitive rankings, streak placement, and the current-user position card disappear from the student UI when disabled."
          />
        )}
      </PreviewViewport>
    </PreviewScaffold>
  );
}

export function BookmarksEnabledPreview() {
  const bookmarksEnabled = useFeature("bookmarksEnabled");
  const bookmarkedTopics = previewAnalyticsService.getBookmarkedTopics();

  return (
    <PreviewScaffold
      title="Bookmarks & Flashcards"
      subtitle="Shows saved study items with no dependency on real accounts, local storage, or Supabase-backed bookmark records."
    >
      <PreviewViewport toolbarRight={<FlagStateBadge active={bookmarksEnabled} activeLabel="Bookmarks On" inactiveLabel="Bookmarks Off" />}>
        {bookmarksEnabled ? (
          <div className="space-y-3">
            {bookmarkedTopics.map((item) => (
              <div key={item.title} className="rounded-2xl border border-[#0f1e3c]/10 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-[#f6f1e6] p-2">
                      <Bookmark size={16} className="text-[#0f1e3c]" />
                    </div>
                    <div>
                      <div className="font-serif text-[18px] text-[#0f1e3c]">{item.title}</div>
                      <div className="text-[11px] text-[#6b7280]">{item.kind}</div>
                    </div>
                  </div>
                  <div className="text-[11px] font-medium text-[#0f1e3c]">{item.count}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <DisabledOverlay
            title="Saved-study tools are unavailable"
            body="Bookmark actions, saved topic shelves, and flashcard entry points become unavailable in the disabled draft state."
          />
        )}
      </PreviewViewport>
    </PreviewScaffold>
  );
}

export function SearchEnabledPreview() {
  const searchEnabled = useFeature("searchEnabled");
  const searchResults = previewAnalyticsService.getSearchResults();

  return (
    <PreviewScaffold
      title="Global Search"
      subtitle="Mirrors the search entry experience with static result groups and no live indexing or network calls."
    >
      <PreviewViewport toolbarRight={<FlagStateBadge active={searchEnabled} activeLabel="Search On" inactiveLabel="Search Off" />}>
        {searchEnabled ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl border border-[#0f1e3c]/10 bg-white px-4 py-3">
              <Search size={16} className="text-[#6b7280]" />
              <span className="text-[13px] text-[#6b7280]">Search aviation articles, systems, mocks...</span>
            </div>
            <div className="space-y-3">
              {searchResults.map((result) => (
                <div key={result.title} className="rounded-2xl border border-[#0f1e3c]/10 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-serif text-[17px] text-[#0f1e3c]">{result.title}</div>
                      <div className="text-[11px] text-[#6b7280]">{result.route}</div>
                    </div>
                    <span className="rounded-full bg-[#f3eee2] px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-[#0f1e3c]">
                      {result.tag}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <DisabledOverlay
            title="Search entry is removed"
            body="The quick search launcher and result overlay disappear entirely when the draft flag is turned off."
          />
        )}
      </PreviewViewport>
    </PreviewScaffold>
  );
}

export function ReferralProgramPreview() {
  const referralProgram = useFeature("referralProgram");
  const referralStatistics = previewAnalyticsService.getReferralStatistics();

  return (
    <PreviewScaffold
      title="Referral Program"
      subtitle="Previews the rewards panel with static invite metrics and no dependency on payout, billing, or backend tracking."
    >
      <PreviewViewport toolbarRight={<FlagStateBadge active={referralProgram} activeLabel="Referrals On" inactiveLabel="Referrals Off" />}>
        {referralProgram ? (
          <div className="space-y-4">
            <MetricGrid items={referralStatistics.map((item) => ({ ...item, tone: "neutral" as const }))} />
            <div className="rounded-2xl border border-[#0f1e3c]/10 bg-white p-4">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-[#0f1e3c]" />
                <div className="font-serif text-[18px] text-[#0f1e3c]">Referral code: FLY-HEADING-24</div>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-[#6b7280]">
                Invite cards, activation counts, and reward summaries stay interactive in preview
                mode without triggering real referral attribution.
              </p>
            </div>
          </div>
        ) : (
          <DisabledOverlay
            title="Referral tools are hidden"
            body="Invite surfaces, code blocks, and referral statistics are removed from the product when the draft flag is off."
          />
        )}
      </PreviewViewport>
    </PreviewScaffold>
  );
}

export function PredictiveIntelligencePreview() {
  const predictiveIntelligence = useFeature("predictiveIntelligence");
  const predictiveMetrics = previewAnalyticsService.getPredictiveMetrics();

  return (
    <PreviewScaffold
      title="Predictive Intelligence"
      subtitle="Service source: previewAnalyticsService. Models pass probability, readiness confidence, and subject risk without calling any external analytics service."
    >
      <PreviewViewport toolbarRight={<FlagStateBadge active={predictiveIntelligence} activeLabel="Predictive On" inactiveLabel="Predictive Off" />}>
        {predictiveIntelligence ? (
          <div className="space-y-4">
            <MetricGrid items={predictiveMetrics.map((metric) => ({ label: metric.label, value: metric.value, delta: metric.confidence, tone: metric.trend === "up" ? "positive" : metric.trend === "down" ? "warning" : "neutral" }))} />
            <div className="space-y-3">
              {predictiveMetrics.map((metric) => (
                <InfoCard key={metric.label} title={metric.label} body={metric.narrative} tone={metric.trend === "down" ? "warning" : "muted"} />
              ))}
            </div>
          </div>
        ) : (
          <DisabledOverlay
            title="Predictive intelligence is unavailable"
            body="Probability forecasts, confidence indicators, and subject risk calls stay hidden until the draft flag is enabled."
          />
        )}
      </PreviewViewport>
    </PreviewScaffold>
  );
}

export function ExamReadinessDashboardPreview() {
  const examReadinessDashboard = useFeature("examReadinessDashboard");
  const dashboard = previewAnalyticsService.getReadinessDashboard();

  return (
    <PreviewScaffold
      title="Exam Readiness Dashboard"
      subtitle="Service source: previewAnalyticsService. Simulates the readiness score surface with subject breakdowns and recommendations."
    >
      <PreviewViewport toolbarRight={<FlagStateBadge active={examReadinessDashboard} activeLabel="Dashboard On" inactiveLabel="Dashboard Off" />}>
        {examReadinessDashboard ? (
          <div className="space-y-4">
            <MetricGrid
              items={[
                { label: "Readiness", value: dashboard.readinessPercentage, delta: dashboard.readinessTrend, tone: "positive" as const },
                { label: "Focus", value: "Meteorology", delta: "highest variance", tone: "warning" as const },
                { label: "Status", value: "Climbing", delta: "steady momentum", tone: "neutral" as const },
              ]}
            />
            <div className="space-y-3">
              {dashboard.subjectBreakdown.map((item) => (
                <div key={item.subject} className="rounded-2xl border border-[#0f1e3c]/10 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-serif text-[18px] text-[#0f1e3c]">{item.subject}</div>
                      <div className="text-[11px] text-[#6b7280]">Trend {item.trend}</div>
                    </div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#0f1e3c]">{item.readiness}%</div>
                  </div>
                  <div className="mt-3 h-3 rounded-full bg-[#e8edf5]">
                    <div className="h-3 rounded-full bg-[#0f1e3c]" style={{ width: `${item.readiness}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <InfoCard title="Recommendation summary" body={dashboard.recommendationSummary} />
          </div>
        ) : (
          <DisabledOverlay
            title="Readiness dashboard is unavailable"
            body="Readiness scoring, subject breakdown cards, and recommendation summaries are not shown when the draft flag is off."
          />
        )}
      </PreviewViewport>
    </PreviewScaffold>
  );
}

export function ExamReadinessEtaPreview() {
  const examReadinessEta = useFeature("examReadinessEta");
  const eta = previewAnalyticsService.getReadinessEta();

  return (
    <PreviewScaffold
      title="Exam Readiness ETA"
      subtitle="Service source: previewAnalyticsService. Shows an estimated readiness date, trajectory copy, and milestone timeline from mock analytics data."
    >
      <PreviewViewport toolbarRight={<FlagStateBadge active={examReadinessEta} activeLabel="ETA On" inactiveLabel="ETA Off" />}>
        {examReadinessEta ? (
          <div className="space-y-4">
            <MetricGrid
              items={[
                { label: "Ready by", value: eta.estimatedReadyDate, delta: "projected date", tone: "positive" as const },
                { label: "Trajectory", value: "On pace", delta: "target holding", tone: "neutral" as const },
                { label: "Milestones", value: `${eta.milestones.length}`, delta: "tracked checkpoints", tone: "neutral" as const },
              ]}
            />
            <InfoCard title="Completion trajectory" body={eta.completionTrajectory} />
            <div className="space-y-3">
              {eta.milestones.map((milestone) => (
                <div key={milestone.label} className="rounded-2xl border border-[#0f1e3c]/10 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-serif text-[17px] text-[#0f1e3c]">{milestone.label}</div>
                      <div className="text-[11px] text-[#6b7280]">{milestone.targetDate}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.16em] ${
                      milestone.status === "completed"
                        ? "bg-emerald-100 text-emerald-700"
                        : milestone.status === "active"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-200 text-slate-600"
                    }`}>
                      {milestone.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <DisabledOverlay
            title="Readiness ETA is unavailable"
            body="Projected readiness date, completion trajectory, and milestone timeline remain hidden while this draft flag is off."
          />
        )}
      </PreviewViewport>
    </PreviewScaffold>
  );
}

export function MasteryAnalyticsPreview() {
  const masteryAnalytics = useFeature("masteryAnalytics");
  const analytics = previewAnalyticsService.getMasteryAnalytics();

  return (
    <PreviewScaffold
      title="Mastery Analytics"
      subtitle="Service source: previewAnalyticsService. Previews mastery distribution, strengths, weaknesses, and improvement suggestions using centralized mock analytics data."
    >
      <PreviewViewport toolbarRight={<FlagStateBadge active={masteryAnalytics} activeLabel="Mastery On" inactiveLabel="Mastery Off" />}>
        {masteryAnalytics ? (
          <div className="space-y-4">
            <MetricGrid items={analytics.distribution.map((item) => ({ label: item.label, value: item.value, tone: "neutral" as const }))} />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <InfoCard title="Strengths" body={analytics.strengths.join(" • ")} />
              <InfoCard title="Weaknesses" body={analytics.weaknesses.join(" • ")} tone="warning" />
              <InfoCard title="Suggestions" body={analytics.suggestions.join(" • ")} tone="muted" />
            </div>
          </div>
        ) : (
          <DisabledOverlay
            title="Mastery analytics are unavailable"
            body="Distribution panels, strength and weakness summaries, and improvement suggestions are hidden in the disabled state."
          />
        )}
      </PreviewViewport>
    </PreviewScaffold>
  );
}

export function MissionScoresPreview() {
  const missionScores = useFeature("missionScores");
  const scoreCards = previewAnalyticsService.getMissionScores();

  return (
    <PreviewScaffold
      title="Mission Scores"
      subtitle="Service source: previewAnalyticsService. Shows challenge scorecards, progress metrics, and ranking indicators with static preview analytics data."
    >
      <PreviewViewport toolbarRight={<FlagStateBadge active={missionScores} activeLabel="Scores On" inactiveLabel="Scores Off" />}>
        {missionScores ? (
          <div className="space-y-3">
            {scoreCards.map((card) => (
              <div key={card.title} className="rounded-2xl border border-[#0f1e3c]/10 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-serif text-[18px] text-[#0f1e3c]">{card.title}</div>
                    <div className="mt-1 text-[11px] text-[#6b7280]">{card.progressLabel}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#0f1e3c]">{card.score}</div>
                    <div className="mt-1 text-[11px] text-[#6b7280]">{card.rankLabel}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <DisabledOverlay
            title="Mission scorecards are unavailable"
            body="Challenge results, progress metrics, and ranking indicators are removed from the preview when this draft flag is off."
          />
        )}
      </PreviewViewport>
    </PreviewScaffold>
  );
}
