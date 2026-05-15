import type { Context, Scenes } from 'telegraf';
import type { User as DbUser } from '@prisma/client';
import type { Locale } from '../i18n';
import type { WizardState } from '../types';

export interface SessionData extends Scenes.SceneSession<SceneSessionData> {
  /** Set by `/start tpl_<code>` deep-link, consumed by the wizard scene
   *  to skip the template picker. */
  pendingTemplateCode?: string;
}

export interface SceneSessionData extends Scenes.SceneSessionData {
  state?: WizardState;
}

export interface BotContext extends Context {
  session: SessionData;
  scene: Scenes.SceneContextScene<BotContext, SceneSessionData>;
  dbUser?: DbUser;
  locale: Locale;
}
