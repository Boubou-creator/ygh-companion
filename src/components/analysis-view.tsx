'use client';
import type { Dispatch, SetStateAction } from 'react';
import { Activity, CircleHelp, Sparkles } from 'lucide-react';
import type { Card, Entry } from '@/lib/types';
import { openingProbability } from '@/lib/rules';
interface Props {
  entries: Entry[];
  known: Record<number, Card>;
  mainCount: number;
  probabilityIds: number[];
  setProbabilityIds: Dispatch<SetStateAction<number[]>>;
}
export default function AnalysisView({
  entries,
  known,
  mainCount,
  probabilityIds,
  setProbabilityIds,
}: Props) {
  const successCount = entries
    .filter((e) => e.zone === 'main' && probabilityIds.includes(e.cardId))
    .reduce((sum, e) => sum + e.quantity, 0);
  const probability = openingProbability(mainCount, successCount);
  return (
    <div className="analysis-grid">
      <section className="panel analysis-card">
        <div className="eyebrow">
          <Activity size={14} /> LABORATOIRE DE MAIN DE DÉPART
        </div>
        <h2>Les chiffres, avant le duel.</h2>
        <p>
          Sélectionnez vos cartes cibles. Calculez la probabilité d’en ouvrir au moins une dans une
          main de cinq cartes.
        </p>
        <div className="probability-number">
          {(probability * 100).toFixed(1)}
          <span>%</span>
        </div>
        <div className="probability-track">
          <i style={{ width: `${probability * 100}%` }} />
        </div>
        <div className="probability-details">
          <span>
            <strong>{mainCount}</strong> cartes dans le Main
          </span>
          <span>
            <strong>{successCount}</strong> exemplaires cibles
          </span>
          <span>
            <strong>5</strong> cartes piochées
          </span>
        </div>
        <div className="analysis-note">
          <CircleHelp size={17} />
          <p>
            Calcul hypergéométrique exact, sans remplacement. Il mesure la présence des cartes
            choisies, pas leur jouabilité ni la réussite d’un combo.{' '}
            {mainCount < 40 && 'Votre Main Deck contient moins de 40 cartes.'}
          </p>
        </div>
      </section>
      <section className="panel target-selection">
        <h2>Vos cartes cibles</h2>
        <p>Par exemple, les handtraps ou les starters de votre moteur.</p>
        {entries
          .filter((e) => e.zone === 'main')
          .map((entry) => {
            const card = known[entry.cardId];
            if (!card) return null;
            return (
              <label key={entry.cardId}>
                <input
                  type="checkbox"
                  checked={probabilityIds.includes(card.id)}
                  onChange={() =>
                    setProbabilityIds((old) =>
                      old.includes(card.id)
                        ? old.filter((id) => id !== card.id)
                        : [...old, card.id],
                    )
                  }
                />
                <span className={`category-mini ${card.category.toLowerCase()}`} />
                <span>{card.name}</span>
                <b>{entry.quantity}×</b>
              </label>
            );
          })}
        {!entries.some((e) => e.zone === 'main') && (
          <p>Ajoutez des cartes au Main Deck pour commencer.</p>
        )}
      </section>
      <section className="panel assistant-preview">
        <span className="assistant-icon">
          <Sparkles size={22} />
        </span>
        <div>
          <div className="eyebrow">LA SUITE DU COMPAGNON</div>
          <h3>Un assistant qui connaît votre deck.</h3>
          <p>
            Synergies, suggestions de ratios et échanges sur vos choix : l’assistant conversationnel
            est prévu pour la phase 2. Les calculs ci-dessus fonctionnent déjà, sans IA.
          </p>
        </div>
        <span className="tag">BIENTÔT</span>
      </section>
    </div>
  );
}
