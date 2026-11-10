import { About } from './screens/About';
import { Game } from './screens/Game';
import { GameOver } from './screens/GameOver';
import { Home } from './screens/Home';
import { useGame } from './store';

export function App() {
  const screen = useGame((s) => s.screen);
  switch (screen) {
    case 'game':
      return <Game />;
    case 'gameover':
      return <GameOver />;
    case 'about':
      return <About />;
    default:
      return <Home />;
  }
}
