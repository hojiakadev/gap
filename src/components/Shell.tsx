import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, IconButton, Menu, MenuItem, Tooltip } from '@mui/material';
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlined from '@mui/icons-material/LightModeOutlined';
import PersonOutlineRounded from '@mui/icons-material/PersonOutlineRounded';
import MoreHorizRounded from '@mui/icons-material/MoreHorizRounded';
import { LanguageSelector } from './LanguageSelector';
import { useAppearance } from '../app/AppearanceProvider';
import { Brand } from './Brand';
export type Page = 'home' | 'how' | 'privacy';
interface Props {
  children: ReactNode;
  inRoom?: boolean;
  page: Page;
  onPage: (page: Page) => void;
  name: string;
  onSettings: () => void;
}
export function Shell({ children, page, onPage, name, onSettings, inRoom }: Props) {
  const { t } = useTranslation();
  const { mode, toggleMode } = useAppearance();
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  return (
    <div className={`app-shell ${inRoom ? 'chat-active' : ''}`}>
      <header className="site-header">
        <div className="header-inner">
          <Brand onClick={() => onPage('home')} />
          <nav className="header-nav" aria-label={t('Main navigation')}>
            <button className={page === 'home' ? 'active' : ''} onClick={() => onPage('home')}>
              {t('Workspace')}
            </button>
            <button className={page === 'how' ? 'active' : ''} onClick={() => onPage('how')}>
              {t('How it works')}
            </button>
            <button
              className={page === 'privacy' ? 'active' : ''}
              onClick={() => onPage('privacy')}
            >
              {t('Privacy by design')}
            </button>
          </nav>
          <div className="header-actions">
            <Tooltip title={t('Display name')}>
              <Button
                className="header-name"
                color="inherit"
                onClick={onSettings}
                aria-label={t('Edit name')}
                startIcon={<PersonOutlineRounded fontSize="small" />}
              >
                <span>{name || t('Enter your name')}</span>
              </Button>
            </Tooltip>
            <LanguageSelector />
            <Tooltip title={t(mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode')}>
              <IconButton
                className="theme-toggle"
                onClick={toggleMode}
                aria-label={t(mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode')}
              >
                {mode === 'light' ? (
                  <DarkModeOutlined fontSize="small" />
                ) : (
                  <LightModeOutlined fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
            <IconButton
              className="mobile-menu"
              aria-label={t('More options')}
              aria-haspopup="menu"
              aria-expanded={!!menu}
              onClick={(event) => setMenu(event.currentTarget)}
            >
              <MoreHorizRounded />
            </IconButton>
          </div>
          <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
            <MenuItem
              onClick={() => {
                setMenu(null);
                onSettings();
              }}
            >
              {t('Edit name')}
            </MenuItem>
            {(['home', 'how', 'privacy'] as const).map((value) => (
              <MenuItem
                key={value}
                selected={page === value}
                onClick={() => {
                  onPage(value);
                  setMenu(null);
                }}
              >
                {t(
                  value === 'home'
                    ? 'Workspace'
                    : value === 'how'
                      ? 'How it works'
                      : 'Privacy by design',
                )}
              </MenuItem>
            ))}
          </Menu>
        </div>
      </header>
      <main className={`workspace ${page === 'home' ? 'workspace-home' : ''}`}>{children}</main>
    </div>
  );
}
