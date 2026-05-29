import { useEffect, useRef } from 'react';
import { getTg } from './tg';

/**
 * Sync Telegram's MainButton (the big bottom button) with this component
 * while it's mounted. Pass `show:false` to hide the button — useful on
 * pages that don't need a primary action. Click handler is updated on
 * every render so closures over fresh state are safe.
 */
export function useMainButton(opts: {
  text: string;
  show: boolean;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const cbRef = useRef(opts.onClick);
  cbRef.current = opts.onClick;

  useEffect(() => {
    const tg = getTg();
    const handler = () => cbRef.current();
    if (opts.show) {
      tg.MainButton.setText(opts.text);
      if (opts.disabled) tg.MainButton.disable();
      else tg.MainButton.enable();
      if (opts.loading) tg.MainButton.showProgress(true);
      else tg.MainButton.hideProgress();
      tg.MainButton.show();
      tg.MainButton.onClick(handler);
    } else {
      tg.MainButton.hide();
    }
    return () => {
      tg.MainButton.offClick(handler);
      tg.MainButton.hide();
    };
  }, [opts.text, opts.show, opts.loading, opts.disabled]);
}

/** Sync Telegram's BackButton. */
export function useBackButton(onBack: () => void, enabled = true) {
  const cbRef = useRef(onBack);
  cbRef.current = onBack;
  useEffect(() => {
    const tg = getTg();
    const handler = () => cbRef.current();
    if (enabled) {
      tg.BackButton.onClick(handler);
      tg.BackButton.show();
    }
    return () => {
      tg.BackButton.offClick(handler);
      tg.BackButton.hide();
    };
  }, [enabled]);
}
