import { FormControl, MenuItem, Select } from '@mui/material';
import TranslateRounded from '@mui/icons-material/TranslateRounded';
import { useTranslation } from 'react-i18next';
import { isLanguage, LANGUAGES, languageNames } from '../i18n/resources';
export function LanguageSelector() {
  const { t, i18n } = useTranslation();
  return (
    <FormControl className="language-selector" size="small">
      <Select
        value={i18n.resolvedLanguage ?? 'en'}
        onChange={(event) => {
          if (isLanguage(event.target.value)) void i18n.changeLanguage(event.target.value);
        }}
        inputProps={{ 'aria-label': t('Interface language') }}
        renderValue={(value) => (
          <span className="language-value">
            <TranslateRounded sx={{ fontSize: 17 }} />
            <span>{isLanguage(value) ? languageNames[value] : 'English'}</span>
          </span>
        )}
      >
        {LANGUAGES.map((language) => (
          <MenuItem key={language} value={language} lang={language}>
            {languageNames[language]}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
