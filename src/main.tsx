import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@fontsource/roboto/400-italic.css';
import '@fontsource/roboto/700-italic.css';
import './i18n';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { AppearanceProvider } from './app/AppearanceProvider';
import './app/styles.css';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <AppearanceProvider>
    <App />
  </AppearanceProvider>,
);
