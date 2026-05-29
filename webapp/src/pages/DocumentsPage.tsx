import { useEffect, useState } from 'react';
import { getTg } from '../tg';
import { t } from '../i18n';
import { api, type DocumentSummary } from '../api';
import { useBackTo, type PageCtx } from '../App';
import { Page } from '../components/Page';
import { List, ListItem } from '../components/List';
import { Loader, ErrorBox } from '../components/Loader';

export function DocumentsPage(ctx: PageCtx) {
  useBackTo('/');

  const [docs, setDocs] = useState<DocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.documents().then(setDocs).catch((e) => setError(String(e.message ?? e)));
  }, []);

  return (
    <Page title={t(ctx.locale, 'docs.title')}>
      {error && <ErrorBox message={error} />}
      {!docs && !error && <Loader label={t(ctx.locale, 'loading')} />}
      {docs && docs.length === 0 && (
        <div className="text-center py-10 text-tg-subtitle">{t(ctx.locale, 'docs.empty')}</div>
      )}
      {docs && docs.length > 0 && (
        <List>
          {docs.map((d) => (
            <ListItem
              key={d.id}
              title={d.fileName}
              subtitle={`${d.format.toUpperCase()} · ${new Date(d.createdAt).toLocaleString()}`}
              trailing={
                <a
                  href={`/api/documents/${d.downloadToken}/file`}
                  download
                  onClick={() => getTg().HapticFeedback.impactOccurred('light')}
                  className="text-tg-link text-[14px] font-medium"
                >
                  {t(ctx.locale, 'btn.open')}
                </a>
              }
            />
          ))}
        </List>
      )}
    </Page>
  );
}
