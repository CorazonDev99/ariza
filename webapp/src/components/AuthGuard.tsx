import { useState, type ReactNode } from 'react';
import { getInitData, getTg } from '../tg';

/**
 * Gate every authenticated render on the presence of Telegram initData.
 *
 * Reply-keyboard `web_app` buttons can fail to pass initData on some
 * Telegram clients (notably Telegram Desktop with certain Mini App
 * configurations). Without initData, every authenticated API call
 * 401's — and the user gets stranded mid-flow. This guard catches
 * the situation up-front and shows a friendly diagnostic + fixes,
 * instead of letting the user fill in a whole form and then fail at
 * Generate.
 *
 * The check is a one-time read at mount: initData is supposed to be
 * stable for the WebApp session.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(false);
  const initData = getInitData();
  const tg = getTg();
  const ok = initData && initData.length > 10;

  if (ok) return <>{children}</>;

  return (
    <div className="min-h-full text-tg-text p-5 flex flex-col gap-4 safe-top safe-bottom">
      <div className="card rounded-[20px] p-5">
        <div className="text-[20px] font-bold mb-2">⚠️ Telegram не передал данные авторизации</div>
        <div className="text-[14px] text-tg-subtitle leading-relaxed">
          Mini App запустился, но Telegram не передал signed initData.
          Без него мы не можем подтвердить, что это вы, и серверные
          функции (генерация документов, сохранение) недоступны.
          <br/><br/>
          <b>Просмотр расписания судов</b> работает без авторизации —
          можете открыть «📋 Ишимни текшириш» из главного меню.
        </div>
      </div>

      <div className="card rounded-[20px] p-5">
        <div className="text-[16px] font-semibold mb-3">🔧 Как исправить</div>
        <ol className="text-[14px] leading-relaxed space-y-3 list-decimal pl-5">
          <li>
            <b>Откройте на смартфоне</b> — мобильный Telegram передаёт
            initData надёжнее, чем Desktop. Часто этого достаточно.
          </li>
          <li>
            <b>Настройте menu-кнопку через BotFather</b> (одноразово):
            откройте @BotFather → /mybots → ваш бот → Bot Settings → Menu
            Button → Configure Menu Button → вставьте URL Mini App. Теперь
            у пользователей появится постоянная кнопка ≡ слева от поля
            ввода — Mini App, запущенный через неё, всегда получает initData.
          </li>
          <li>
            <b>Обновите Telegram Desktop</b> до последней версии —
            старые сборки имеют известный баг с reply-keyboard web_app.
          </li>
          <li>
            <b>Полностью перезапустите Telegram</b> (закрыть → запустить
            заново). Иногда помогает сбросить кеш.
          </li>
        </ol>
      </div>

      <button
        onClick={() => window.location.reload()}
        className="press brand-bg text-tg-button-text rounded-2xl p-4 font-semibold ring-accent"
      >
        🔄 Перезагрузить страницу
      </button>

      <button
        onClick={() => setShow((s) => !s)}
        className="card rounded-[20px] p-3 text-[13px] text-tg-link"
      >
        {show ? 'Скрыть' : 'Показать'} диагностику
      </button>

      {show && (
        <div className="card rounded-[20px] p-4 text-[11px] font-mono break-all leading-relaxed">
          <div className="text-tg-subtitle mb-1">platform:</div>
          <div>{tg.platform || '—'}</div>
          <div className="text-tg-subtitle mt-2 mb-1">version:</div>
          <div>{tg.version || '—'}</div>
          <div className="text-tg-subtitle mt-2 mb-1">initData (length):</div>
          <div>{initData ? `"${initData.substring(0, 60)}..." (${initData.length} chars)` : 'empty'}</div>
          <div className="text-tg-subtitle mt-2 mb-1">initDataUnsafe.user:</div>
          <div>
            {tg.initDataUnsafe.user
              ? JSON.stringify(tg.initDataUnsafe.user)
              : 'absent'}
          </div>
          <div className="text-tg-subtitle mt-2 mb-1">window.location.hash:</div>
          <div>{window.location.hash || 'empty'}</div>
        </div>
      )}
    </div>
  );
}
