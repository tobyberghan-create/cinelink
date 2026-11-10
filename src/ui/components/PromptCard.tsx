import { config } from '../../config';
import { eligibleCast, type CastCredit, type FilmCredits } from '../../engine';
import { posterUrl, profileUrl } from '../api';

/** `short:` variant (src/index.css) = viewport under 560px tall, i.e. the on-screen keyboard is open. */
export function Portrait({ src, alt, shape }: { src: string | null; alt: string; shape: 'person' | 'poster' }) {
  const cls =
    shape === 'person'
      ? `h-36 w-36 short:h-16 short:w-16 rounded-full`
      : `h-44 w-[7.33rem] short:h-24 short:w-16 rounded-lg`;
  return src ? (
    <img src={src} alt={alt} className={`${cls} shrink-0 bg-zinc-800 object-cover shadow-lg shadow-black/50`} />
  ) : (
    <div className={`${cls} flex shrink-0 items-center justify-center bg-zinc-800 text-4xl text-zinc-600`} aria-hidden>
      {shape === 'person' ? '👤' : '🎬'}
    </div>
  );
}

export function ActorPrompt({ actor }: { actor: CastCredit }) {
  return (
    <section className={`flex flex-col items-center gap-3 px-4 pt-4 text-center short:flex-row short:text-left short:pt-2`} aria-live="polite">
      <Portrait src={profileUrl(actor.profilePath)} alt={actor.name} shape="person" />
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-widest text-zinc-500">Name a film with</p>
        <h2 className={`mt-1 text-2xl font-bold leading-tight short:text-xl`}>{actor.name}</h2>
      </div>
    </section>
  );
}

export function FilmPrompt({ film }: { film: FilmCredits }) {
  const director = film.crew.filter((c) => c.job === 'Director').map((c) => c.name);
  const cast = eligibleCast(film).slice(0, config.filmChain.nudgeCastCount).map((c) => c.name);
  return (
    <section className={`flex items-center gap-4 px-4 pt-4 short:pt-2`} aria-live="polite">
      <Portrait src={posterUrl(film.posterPath)} alt={`${film.title} poster`} shape="poster" />
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-widest text-zinc-500">Name a film linked to</p>
        <h2 className="mt-1 text-xl font-bold leading-tight">
          {film.title} {film.year && <span className="font-normal text-zinc-400">({film.year})</span>}
        </h2>
        {director.length > 0 && <p className="mt-2 text-sm text-zinc-300">Dir. {director.join(', ')}</p>}
        {cast.length > 0 && <p className={`mt-1 text-sm leading-snug text-zinc-400 short:hidden`}>{cast.join(' · ')}</p>}
      </div>
    </section>
  );
}
