import CodeRounded from '@mui/icons-material/CodeRounded';
import ImageOutlined from '@mui/icons-material/ImageOutlined';
import LinkRounded from '@mui/icons-material/LinkRounded';
import NotesRounded from '@mui/icons-material/NotesRounded';
export function TunnelArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="orbit outer" />
      <div className="orbit" />
      <div className="folder-back" />
      <div className="art-folder" />
      <div className="art-tile tile-code">
        <CodeRounded />
      </div>
      <div className="art-tile tile-image">
        <ImageOutlined />
      </div>
      <div className="art-tile tile-text">
        <NotesRounded />
      </div>
      <div className="art-tile tile-link">
        <LinkRounded />
      </div>
      <span className="art-spark">✳</span>
      <span className="art-circle" />
    </div>
  );
}
