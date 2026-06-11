import type { Context, Scenes } from 'telegraf';
import type { User as DbUser } from '@prisma/client';
import type { Locale } from '../i18n';
import type { WizardState } from '../types';

export interface SessionData extends Scenes.SceneSession<SceneSessionData> {
  /** Set by `/start tpl_<code>` deep-link, consumed by the wizard scene
   *  to skip the template picker. */
  pendingTemplateCode?: string;
  /** Scratchpad for the "📖 Қўлланма" guide flow's multi-step picker
   *  (court type → region → district → template). Lives outside the
   *  scene because the guide doesn't enter the wizard scene until the
   *  user clicks "Start filling". When that happens it's copied into
   *  `pendingPicker` so the wizard can skip its own picker steps. */
  guidePicker?: {
    courtTypeCode?: string;
    regionCode?: string;
    districtCourtCode?: string;
  };
  /** Set when the user enters the wizard from a fully-picked guide
   *  flow — tells `scene.enter` to skip court/region/district pickers
   *  and start the field wizard immediately. Cleared on first read. */
  pendingPicker?: {
    courtTypeCode: string;
    regionCode: string;
    districtCourtCode: string;
  };
  /** Scratchpad for the "📋 Проверить дело" jadval2 lookup flow.
   *  Lives outside any scene — handlers are plain `bot.action(...)`. */
  jadvalPicker?: {
    courtTypeCode?: string;
    regionCode?: string;
    /** Picked court — stored once we move to the date step. Lets the
     *  date/search/back handlers refetch without making the user repick. */
    courtCode?: string;
    /** Picked date in ISO "YYYY-MM-DD" form so it survives JSON
     *  serialization of the session. */
    date?: string;
    /** True between "🔍 Поиск" click and the user's next text message.
     *  The text handler in commands.ts treats that next text as a
     *  filter query against the cached schedule. */
    searchPending?: boolean;
  };
  /** Scratchpad for the "🏛 Судлар маълумоти" court-directory flow
   *  (region → court type → court → info card). Plain `bot.action(...)`
   *  handlers, like the jadval flow. */
  courtInfoPicker?: {
    regionCode?: string;
    courtTypeCode?: string;
  };
  /** True between the "📝 Шикоят ва таклифлар" tap and the user's next
   *  message — that message is forwarded to the feedback group. */
  feedbackPending?: boolean;
  /** True while the user is in "🤖 AI-Yurist" chat mode — every text
   *  message is answered by the AI until they tap another menu button
   *  or the inline "Yakunlash" button. */
  aiYuristPending?: boolean;
}

export interface SceneSessionData extends Scenes.SceneSessionData {
  state?: WizardState;
  /** Scratchpad for the multi-step entry pickers (court type → region →
   *  district) BEFORE a template is chosen. Once the user picks a
   *  template, these are copied into the persistent `WizardState`. */
  picker?: {
    courtTypeCode?: string;
    regionCode?: string;
    districtCourtCode?: string;
  };
}

export interface BotContext extends Context {
  session: SessionData;
  scene: Scenes.SceneContextScene<BotContext, SceneSessionData>;
  dbUser?: DbUser;
  locale: Locale;
}
