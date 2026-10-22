'use client';
import {
  ArrowRight,
  ArrowUpRight,
  Download,
  FolderOpen,
  Layers3,
  Trash2,
  Upload,
} from 'lucide-react';
import type { Deck } from '@/lib/types';
interface Props {
  savedDecks: Deck[];
  onImport: () => void;
  onStudio: () => void;
  onOpen: (deck: Deck) => void;
  onDelete: (deck: Deck) => void;
  onExport: (deck: Deck) => void;
}
export default function DeckLibrary({
  savedDecks,
  onImport,
  onStudio,
  onOpen,
  onDelete,
  onExport,
}: Props) {
  return (
    <section className="library">
      <div className="library-heading">
        <h2>
          Mes decks <span>{savedDecks.length}</span>
        </h2>
        <button className="button" onClick={() => onImport()}>
          <Upload size={15} />
          Importer un YDK
        </button>
      </div>
      {savedDecks.length === 0 ? (
        <div className="panel library-empty">
          <FolderOpen size={40} />
          <h2>Votre collection de stratégies commence ici.</h2>
          <p>Enregistrez votre premier deck depuis le studio.</p>
          <button className="button primary" onClick={() => onStudio()}>
            Ouvrir le Deck Studio <ArrowRight size={15} />
          </button>
        </div>
      ) : (
        <div className="saved-deck-grid">
          {savedDecks.map((deck) => (
            <article className="panel saved-deck" key={deck.id}>
              <div className="saved-deck-art">
                <Layers3 size={56} strokeWidth={1} />
                <span>TCG / DECK {deck.id.slice(0, 4).toUpperCase()}</span>
              </div>
              <div>
                <h3>{deck.name}</h3>
                <p>
                  {deck.entries.reduce((sum, e) => sum + e.quantity, 0)} cartes ·{' '}
                  {new Date(deck.updatedAt).toLocaleDateString('fr-FR')}
                </p>
                <div className="saved-deck-actions">
                  <button className="button" onClick={() => onOpen(deck)}>
                    Ouvrir <ArrowUpRight size={14} />
                  </button>
                  <button
                    className="icon-button"
                    title="Exporter en YDK"
                    aria-label={`Exporter ${deck.name}`}
                    onClick={() => onExport(deck)}
                  >
                    <Download size={16} />
                  </button>
                  <button
                    className="icon-button danger"
                    title="Supprimer"
                    aria-label={`Supprimer ${deck.name}`}
                    onClick={() => onDelete(deck)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
