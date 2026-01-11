import React, { useState, useEffect } from 'react';
import './SlotMachineEasterEgg.css';

interface SlotMachineEasterEggProps {
  isOpen: boolean;
  onClose: () => void;
}

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣', '⭐', '🎰'];

const SlotMachineEasterEgg: React.FC<SlotMachineEasterEggProps> = ({ isOpen, onClose }) => {
  const [reels, setReels] = useState<string[]>(['🎰', '🎰', '🎰']);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string>('');
  const [credits, setCredits] = useState(100);

  useEffect(() => {
    if (!isOpen) {
      setReels(['🎰', '🎰', '🎰']);
      setResult('');
      setSpinning(false);
    }
  }, [isOpen]);

  // 🔊 Функция для генерации звука вращения
  const playSpinSound = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.3);

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  };

  // 🔊 Функция для генерации звука выигрыша
  const playWinSound = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.2);

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  };

  // 🔊 Функция для генерации звука джекпота
  const playJackpotSound = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Играем несколько нот для эффекта фанфар
    const notes = [523, 659, 784, 1047]; // C, E, G, C (октава выше)

    notes.forEach((freq, index) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);

      const startTime = audioContext.currentTime + (index * 0.15);
      gainNode.gain.setValueAtTime(0.4, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

      oscillator.start(startTime);
      oscillator.stop(startTime + 0.3);
    });
  };

  const spin = () => {
    if (spinning || credits < 10) return;

    setSpinning(true);
    setResult('');
    setCredits(prev => prev - 10);

    // 🔊 Играем звук вращения
    playSpinSound();

    const spinDuration = 2000;
    const intervalTime = 100;
    let elapsed = 0;

    const interval = setInterval(() => {
      setReels([
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
      ]);

      elapsed += intervalTime;

      if (elapsed >= spinDuration) {
        clearInterval(interval);
        finishSpin();
      }
    }, intervalTime);
  };

  const finishSpin = () => {
    const finalReels = [
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
    ];

    setReels(finalReels);
    setSpinning(false);

    if (finalReels[0] === finalReels[1] && finalReels[1] === finalReels[2]) {
      const jackpot = finalReels[0] === '💎' ? 500 : 200;
      setCredits(prev => prev + jackpot);
      setResult(`🎉 ДЖЕКПОТ! +${jackpot} кредитов!`);

      // 🔊 Звук джекпота
      playJackpotSound();
    } else if (finalReels[0] === finalReels[1] || finalReels[1] === finalReels[2]) {
      setCredits(prev => prev + 30);
      setResult('✨ Неплохо! +30 кредитов');

      // 🔊 Звук выигрыша
      playWinSound();
    } else {
      setResult('💸 Попробуй еще раз!');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="slot-machine-overlay" onClick={onClose}>
      <div className="slot-machine-modal" onClick={(e) => e.stopPropagation()}>
        <button className="slot-machine-close" onClick={onClose}>×</button>

        <div className="slot-machine-container">
          <h2 className="slot-machine-title">🎰 Казино "Казик" 🎰</h2>

          <div className="slot-machine-credits">
            💰 Кредиты: {credits}
          </div>

          <div className="slot-machine-reels">
            {reels.map((symbol, index) => (
              <div
                key={index}
                className={`slot-reel ${spinning ? 'spinning' : ''}`}
              >
                {symbol}
              </div>
            ))}
          </div>

          {result && (
            <div className={`slot-result ${result.includes('ДЖЕКПОТ') ? 'jackpot' : ''}`}>
              {result}
            </div>
          )}

          <button
            className="slot-spin-button"
            onClick={spin}
            disabled={spinning || credits < 10}
          >
            {spinning ? '🎲 ВРАЩЕНИЕ...' : credits < 10 ? '😢 Недостаточно кредитов' : '🎲 КРУТИТЬ (10 кредитов)'}
          </button>

          <div className="slot-machine-info">
            <p>🍒🍒🍒 = +200 кредитов</p>
            <p>💎💎💎 = +500 кредитов (ДЖЕКПОТ!)</p>
            <p>Два одинаковых = +30 кредитов</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlotMachineEasterEgg;
