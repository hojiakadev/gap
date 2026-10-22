import { useTranslation } from 'react-i18next';
export function Brand({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button className="brand" type="button" onClick={onClick} aria-label={t('Gap home')}>
      Gap.
    </button>
  );
}
