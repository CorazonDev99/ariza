import { useEffect, useState } from 'react';
import { api, type ProfileData } from '../api';
import { getTg } from '../tg';
import { t } from '../i18n';
import { useBackTo, type PageCtx } from '../App';
import { Page } from '../components/Page';

const EMPTY: ProfileData = { fullName: '', address: '', phone: '' };

export function ProfilePage(ctx: PageCtx) {
  useBackTo('/settings');
  getTg().MainButton.hide();

  const [data, setData] = useState<ProfileData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .profile()
      .then((p) => setData({ fullName: p.fullName, address: p.address, phone: p.phone }))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof ProfileData>(key: K, v: string) {
    setData((d) => ({ ...d, [key]: v }));
    setSaved(false);
  }

  async function save() {
    if (saving) return;
    getTg().HapticFeedback.impactOccurred('medium');
    setSaving(true);
    try {
      await api.saveProfile(data);
      setSaved(true);
      getTg().HapticFeedback.notificationOccurred('success');
    } catch {
      getTg().HapticFeedback.notificationOccurred('error');
    } finally {
      setSaving(false);
    }
  }

  const fields: Array<{ key: keyof ProfileData; ml?: boolean }> = [
    { key: 'fullName' },
    { key: 'address', ml: true },
    { key: 'phone' },
  ];

  return (
    <Page
      title={t(ctx.locale, 'profile.title')}
      subtitle={t(ctx.locale, 'profile.subtitle')}
    >
      {loading ? (
        <div className="card rounded-[20px] p-5 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="skeleton h-3 w-24 rounded" />
              <div className="skeleton h-11 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="card rounded-[20px] p-4 space-y-4">
            {fields.map(({ key, ml }) => (
              <label key={key} className="block">
                <span className="text-[13px] font-semibold text-tg-subtitle">
                  {t(ctx.locale, `profile.${key}`)}
                </span>
                {ml ? (
                  <textarea
                    value={data[key]}
                    onChange={(e) => set(key, e.target.value)}
                    rows={2}
                    placeholder={t(ctx.locale, `profile.${key}.ph`)}
                    className="mt-1.5 block w-full resize-none rounded-xl px-3.5 py-2.5 text-[15px] text-tg-text bg-tg-text/[0.05] border border-tg-text/[0.08] placeholder:text-tg-hint focus:outline-none focus:border-tg-text/[0.2] transition-colors"
                  />
                ) : (
                  <input
                    value={data[key]}
                    onChange={(e) => set(key, e.target.value)}
                    inputMode={key === 'phone' ? 'tel' : 'text'}
                    placeholder={t(ctx.locale, `profile.${key}.ph`)}
                    className="mt-1.5 block w-full rounded-xl px-3.5 py-2.5 text-[15px] text-tg-text bg-tg-text/[0.05] border border-tg-text/[0.08] placeholder:text-tg-hint focus:outline-none focus:border-tg-text/[0.2] transition-colors"
                  />
                )}
              </label>
            ))}
          </div>

          <p className="mt-3 px-1 text-[12px] leading-snug text-tg-subtitle">
            {t(ctx.locale, 'profile.hint')}
          </p>

          <button
            onClick={save}
            disabled={saving}
            className="press mt-4 w-full rounded-2xl py-3.5 brand-bg text-white font-bold text-[15px] ring-accent disabled:opacity-60 transition-all"
          >
            {saving
              ? t(ctx.locale, 'profile.saving')
              : saved
                ? t(ctx.locale, 'profile.saved')
                : t(ctx.locale, 'profile.save')}
          </button>
        </>
      )}
    </Page>
  );
}
