import { useState } from 'react';

export type PhotoAssetKind = 'bench' | 'squat' | 'tape';

interface PhotoMetadata {
  src: string;
  alt: string;
  title: string;
  credit: string;
  creditUrl: string;
  aspectRatio: string;
}

const PHOTO_CATALOG: Record<PhotoAssetKind, PhotoMetadata> = {
  bench: {
    src: '/photos/bench-press.jpg',
    alt: 'Athlete performing a barbell bench press on a flat bench in a modern gym',
    title: 'Bench Press',
    credit: 'Andrea Piacquadio / Pexels',
    creditUrl:
      'https://www.pexels.com/photo/strong-sportsman-doing-bench-press-during-workout-in-modern-gym-3837743/',
    aspectRatio: '16 / 10',
  },
  squat: {
    src: '/photos/squat.jpg',
    alt: 'Side-view of an athlete performing a bodyweight squat with neutral spine',
    title: 'Squat Movement',
    credit: 'MART PRODUCTION / Pexels',
    creditUrl: 'https://www.pexels.com/photo/a-woman-exercising-8846530/',
    aspectRatio: '16 / 11',
  },
  tape: {
    src: '/photos/waist-measurement.jpg',
    alt: 'Close-up of measuring tape placed horizontally around the natural waistline',
    title: 'Circumference Tape Placement',
    credit: 'Gustavo Fring / Pexels',
    creditUrl: 'https://www.pexels.com/photo/woman-measuring-waist-with-tape-measure-5622199/',
    aspectRatio: '16 / 10',
  },
};

export interface MediaReferenceProps {
  photo: PhotoAssetKind;
  caption?: string;
  showCredit?: boolean;
  className?: string;
}

export function MediaReference({
  photo,
  caption,
  showCredit = true,
  className = '',
}: MediaReferenceProps) {
  const meta = PHOTO_CATALOG[photo];
  const [loadError, setLoadError] = useState(false);

  return (
    <figure className={`media-reference ${className}`}>
      <div className="media-frame" style={{ aspectRatio: meta.aspectRatio }}>
        {!loadError ? (
          <img
            src={meta.src}
            alt={meta.alt}
            className="media-img"
            loading="lazy"
            onError={() => setLoadError(true)}
          />
        ) : (
          <div className="media-fallback" role="img" aria-label={meta.alt}>
            <span className="media-fallback-title">{meta.title} (Visual Reference)</span>
            <span className="media-fallback-sub">
              Local photo unavailable. Calculations and logging unaffected.
            </span>
          </div>
        )}
      </div>
      <figcaption className="media-caption">
        <span className="media-caption-title">{caption || `${meta.title} · reference photo`}</span>
        {showCredit && (
          <a
            href={meta.creditUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="media-credit-link"
          >
            {meta.credit} ↗
          </a>
        )}
      </figcaption>
    </figure>
  );
}
