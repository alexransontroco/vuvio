import { useState, useEffect } from 'react';

export default function AgentsPage() {
  const [content, setContent] = useState(null);
  const [activeMarket, setActiveMarket] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContent(activeMarket);
  }, [activeMarket]);

  async function loadContent(market) {
    setLoading(true);
    try {
      let path = '';
      if (market === 'overview') {
        path = '/agents/MARKETS_OVERVIEW.md';
      } else if (market === 'readme') {
        path = '/agents/README.md';
      } else if (market === 'market-research') {
        path = '/agents/market-research.md';
      } else if (market === 'product-strategy') {
        path = '/agents/product-strategy.md';
      } else {
        path = `/agents/markets/${market}.md`;
      }

      const response = await fetch(path);
      if (response.ok) {
        const text = await response.text();
        setContent(markdownToHtml(text));
      } else {
        setContent('<p>Contenu non trouvé</p>');
      }
    } catch (error) {
      setContent(`<p>Erreur: ${error.message}</p>`);
    } finally {
      setLoading(false);
    }
  }

  function markdownToHtml(md) {
    // Split into lines for processing
    const lines = md.split('\n');
    let html = '';
    let inTable = false;
    let inList = false;
    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code blocks
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          html += '</pre>';
          inCodeBlock = false;
        } else {
          html += '<pre>';
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        html += line + '\n';
        continue;
      }

      // Headings
      if (line.startsWith('# ')) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<h1>${escapeHtml(line.slice(2))}</h1>`;
        continue;
      }
      if (line.startsWith('## ')) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<h2>${escapeHtml(line.slice(3))}</h2>`;
        continue;
      }
      if (line.startsWith('### ')) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<h3>${escapeHtml(line.slice(4))}</h3>`;
        continue;
      }

      // Tables
      if (line.includes('|')) {
        if (!inTable) {
          html += '<table>';
          inTable = true;
        }
        const cells = line.split('|').map(c => c.trim()).filter(c => c);
        html += '<tr>' + cells.map(cell => `<td>${formatInline(cell)}</td>`).join('') + '</tr>';
        continue;
      } else if (inTable) {
        html += '</table>';
        inTable = false;
      }

      // Lists
      if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
        if (!inList) {
          html += '<ul>';
          inList = true;
        }
        const itemText = line.trim().replace(/^[-*]\s/, '');
        html += `<li>${formatInline(itemText)}</li>`;
        continue;
      } else if (inList && line.trim()) {
        html += '</ul>';
        inList = false;
      }

      // Empty lines and paragraphs
      if (line.trim() === '') {
        html += '';
      } else {
        html += `<p>${formatInline(line)}</p>`;
      }
    }

    if (inList) html += '</ul>';
    if (inTable) html += '</table>';
    if (inCodeBlock) html += '</pre>';

    return `<div class="markdown-content">${html}</div>`;
  }

  function formatInline(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  return (
    <div className="agents-page">
      <div className="agents-container">
        <aside className="agents-sidebar">
          <h2>🤖 AI Agents</h2>

          <div className="sidebar-section">
            <h3>📊 Dashboard</h3>
            <button
              className={`sidebar-link ${activeMarket === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveMarket('overview')}
            >
              Overview Global
            </button>
            <button
              className={`sidebar-link ${activeMarket === 'readme' ? 'active' : ''}`}
              onClick={() => setActiveMarket('readme')}
            >
              Getting Started
            </button>
          </div>

          <div className="sidebar-section">
            <h3>🌍 Market Analysis</h3>
            {['espagne', 'france', 'italie', 'allemagne'].map((market) => {
              const labels = {
                espagne: '🇪🇸 España',
                france: '🇫🇷 France',
                italie: '🇮🇹 Italia',
                allemagne: '🇩🇪 Deutschland',
              };
              return (
                <button
                  key={market}
                  className={`sidebar-link ${activeMarket === market ? 'active' : ''}`}
                  onClick={() => setActiveMarket(market)}
                >
                  {labels[market]}
                </button>
              );
            })}
          </div>

          <div className="sidebar-section">
            <h3>📚 Templates</h3>
            <button
              className={`sidebar-link ${activeMarket === 'market-research' ? 'active' : ''}`}
              onClick={() => setActiveMarket('market-research')}
            >
              Market Research
            </button>
            <button
              className={`sidebar-link ${activeMarket === 'product-strategy' ? 'active' : ''}`}
              onClick={() => setActiveMarket('product-strategy')}
            >
              Product Strategy
            </button>
          </div>
        </aside>

        <main className="agents-main">
          {loading ? (
            <div className="agents-loading">Loading...</div>
          ) : (
            <div
              className="agents-content"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
