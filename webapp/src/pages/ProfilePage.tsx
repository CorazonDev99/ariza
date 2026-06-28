import { useEffect, useState } from 'react';
import { api, type ProfileData } from '../api';
import { getTg } from '../tg';
import { t } from '../i18n';
import { useBackTo, type PageCtx } from '../App';
import { Page } from '../components/Page';
import { IconEdit, IconUser } from '../components/icons';

const EMPTY: ProfileData = { fullName: '', address: '', phone: '' };

function hasData(p: ProfileData): boolean {
  return Boolean(p.fullName.trim() || p.address.trim() || p.phone.trim());
}

export function ProfilePage(ctx: PageCtx) {
  useBackTo('/settings');
  getTg().MainButton.hide();

  const [data, setData] = useState<ProfileData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .profile()
      .then((p) => {
        const next = { fullName: p.fullName, address: p.address, phone: p.phone };
        setData(next);
        setEditing(!hasData(next)); // no data yet → start in edit mode
      })
      .catch(() => setEditing(true))
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof ProfileData>(key: K, v: string) {
    setData((d) => ({ ...d, [key]: v }));
  }

  async function save() {
    if (saving) return;
    getTg().HapticFeedback.impactOccurred('medium');
    setSaving(true);
    try {
      const saved = await api.saveProfile(data);
      setData({ fullName: saved.fullName, address: saved.address, phone: saved.phone });
      setEditing(false);
      getTg().HapticFeedback.notificationOccurred('success');
    } catch {
      getTg().HapticFeedback.notificationOccurred('error');
    } finally {
      setSaving(false);
    }
  }

  const rows: Array<keyof ProfileData> = ['fullName', 'address', 'phone'];

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
              <div className="skeleton h-6 w-3/4 rounded" />
            </div>
          ))}
        </div>
      ) : editing ? (
        /* ── Edit mode ─────────────────────────────────────────── */
        <>
          <div className="card rounded-[20px] p-4 space-y-4">
            {rows.map((key) => {
              const ml = key === 'address';
              const common =
                'mt-1.5 block w-full rounded-xl px-3.5 py-2.5 text-[15px] text-tg-text bg-tg-text/[0.05] border border-tg-text/[0.08] placeholder:text-tg-hint focus:outline-none focus:border-tg-text/[0.2] transition-colors';
              return (
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
                      className={`${common} resize-none`}
                    />
                  ) : (
                    <input
                      value={data[key]}
                      onChange={(e) => set(key, e.target.value)}
                      inputMode={key === 'phone' ? 'tel' : 'text'}
                      placeholder={t(ctx.locale, `profile.${key}.ph`)}
                      className={common}
                    />
                  )}
                </label>
              );
            })}
          </div>

          <p className="mt-3 px-1 text-[12px] leading-snug text-tg-subtitle">
            {t(ctx.locale, 'profile.hint')}
          </p>

          <button
            onClick={save}
            disabled={saving}
            className="press mt-4 w-full rounded-2xl py-3.5 brand-bg text-white font-bold text-[15px] ring-accent disabled:opacity-60 transition-all"
          >
            {saving ? t(ctx.locale, 'profile.saving') : t(ctx.locale, 'profile.save')}
          </button>
        </>
      ) : (
        /* ── View mode (read-only card) ────────────────────────── */
        <>
          <div className="reveal card rounded-[22px] overflow-hidden">
            {/* header band */}
            <div className="flex items-center gap-3.5 p-4 border-b border-tg-text/[0.07]">
              <div className="shrink-0 w-12 h-12 rounded-2xl brand-bg grid place-items-center text-white ring-accent">
                <IconUser className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="text-[16px] font-bold text-tg-text truncate">
                  {data.fullName || '—'}
                </div>
                <div className="text-[12px] text-tg-subtitle">
                  {t(ctx.locale, 'profile.menu.sub')}
                </div>
              </div>
            </div>
            {/* rows */}
            <div className="divide-y divide-tg-text/[0.06]">
              {(['address', 'phone'] as Array<keyof ProfileData>).map((key) => (
                <div key={key} className="px-4 py-3">
                  <div className="text-[12px] font-semibold uppercase tracking-wide text-tg-subtitle">
                    {t(ctx.locale, `profile.${key}`)}
                  </div>
                  <div className="mt-0.5 text-[15px] text-tg-text break-words">
                    {data[key] || '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              getTg().HapticFeedback.impactOccurred('light');
              setEditing(true);
            }}
            className="press mt-4 w-full rounded-2xl py-3.5 card flex items-center justify-center gap-2 text-[15px] font-bold text-tg-text"
          >
            <IconEdit className="w-5 h-5 text-tg-subtitle" />
            {t(ctx.locale, 'profile.edit')}
          </button>
        </>
      )}
    </Page>
  );
}
