'use client';
import { useEffect, useRef, useState } from 'react';
import { Sparkles, Swords, Shield, Orbit } from 'lucide-react';
import type { Card } from '@/lib/types';
export default function CardArt({ card, large = false }: { card: Card; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const imageUrl = large ? card.image : card.imageSmall;
  useEffect(() => {
    // A cached image can finish (or fail) before React hydrates its event handlers.
    const image = imageRef.current;
    if (image?.complete) {
      setLoaded(image.naturalWidth > 0);
      setFailed(image.naturalWidth === 0);
    }
  }, [imageUrl]);
  const Icon = card.category === 'Monster' ? Swords : card.category === 'Trap' ? Shield : Sparkles;
  return (
    <div className={`card-art frame-${card.frame} ${large ? 'large-art' : ''}`}>
      <div className="art-fallback" aria-hidden="true">
        <span className="fallback-card-name">{card.name}</span>
        <div className="rune">
          <Orbit size={large ? 80 : 38} strokeWidth={0.7} />
          <Icon className="rune-icon" size={large ? 30 : 18} strokeWidth={1.2} />
        </div>
        <span className="fallback-category">{card.type}</span>
        <div className="fallback-lines">
          <i />
          <i />
          <i />
        </div>
        <span className="fallback-id">{card.id.toString().padStart(8, '0')}</span>
      </div>
      {/* Original card images come directly from the provider; no image redistribution. */}
      {!failed && (
        <img
          key={card.imageSmall}
          ref={imageRef}
          src={imageUrl}
          style={{ opacity: loaded ? 1 : 0 }}
          alt={card.name}
          draggable={false}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
