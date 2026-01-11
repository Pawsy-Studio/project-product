import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import './SlotMachineEasterEgg.css';

interface SlotMachineEasterEggProps {
  isOpen: boolean;
  onClose: () => void;
}

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣', '⭐', '🎰'];
const BET_AMOUNTS = [10, 25, 50, 100];

const SlotMachineEasterEgg: React.FC<SlotMachineEasterEggProps> = ({ isOpen, onClose }) => {
  const [reels, setReels] = useState<string[]>(['🎰', '🎰', '🎰']);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string>('');
  const [credits, setCredits] = useState(100);
  const [selectedBet, setSelectedBet] = useState(10);
  const [winStreak, setWinStreak] = useState(0);
  const [comboMultiplier, setComboMultiplier] = useState(1);

  useEffect(() => {
    if (!isOpen) {
      setReels(['🎰', '🎰', '🎰']);
      setResult('');
      setSpinning(false);
    }
  }, [isOpen]);

  // 🎉 Функция для запуска конфетти
  const triggerConfetti = (isJackpot: boolean = false) => {
    if (isJackpot) {
      // Мощное конфетти для джекпота
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 7,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#FFD700', '#FFA500', '#FF6347', '#FF1493']
        });
        confetti({
          particleCount: 7,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#FFD700', '#FFA500', '#FF6347', '#FF1493']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    } else {
      // Обычное конфетти для выигрыша
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#FFA500', '#00FF00']
      });
    }
  };

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

  // 🔊 Звук остановки барабана
  const playStopSound = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(300, audioContext.currentTime);

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
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

    const notes = [523, 659, 784, 1047];

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
    if (spinning || credits < selectedBet) return;

    setSpinning(true);
    setResult('');
    setCredits(prev => prev - selectedBet);

    playSpinSound();

    // Генерируем финальные символы заранее
    const finalReels = [
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
    ];

    // Анимация вращения с последовательной остановкой барабанов
    spinReelsSequentially(finalReels);
  };

  // 🎰 Плавная последовательная остановка барабанов
  const spinReelsSequentially = (finalReels: string[]) => {
    const spinDuration = 1500;
    const intervalTime = 100;
    let elapsed = 0;
    let stoppedReels = [false, false, false];

    const interval = setInterval(() => {
      setReels(prev => {
        const newReels = [...prev];

        // Останавливаем барабаны последовательно
        if (elapsed >= spinDuration && !stoppedReels[0]) {
          newReels[0] = finalReels[0];
          stoppedReels[0] = true;
          playStopSound();
        } else if (!stoppedReels[0]) {
          newReels[0] = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        }

        if (elapsed >= spinDuration + 300 && !stoppedReels[1]) {
          newReels[1] = finalReels[1];
          stoppedReels[1] = true;
          playStopSound();
        } else if (!stoppedReels[1]) {
          newReels[1] = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        }

        if (elapsed >= spinDuration + 600 && !stoppedReels[2]) {
          newReels[2] = finalReels[2];
          stoppedReels[2] = true;
          playStopSound();
          clearInterval(interval);
          setTimeout(() => finishSpin(finalReels), 300);
        } else if (!stoppedReels[2]) {
          newReels[2] = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        }

        return newReels;
      });

      elapsed += intervalTime;
    }, intervalTime);
  };

  const finishSpin = (finalReels: string[]) => {
    setSpinning(false);

    // Проверка выигрыша
    if (finalReels[0] === finalReels[1] && finalReels[1] === finalReels[2]) {
      // Джекпот!
      const baseJackpot = finalReels[0] === '💎' ? 500 : 200;
      const newStreak = winStreak + 1;
      const newMultiplier = Math.min(1 + (newStreak * 0.2), 3); // Макс x3
      const totalWin = Math.floor(baseJackpot * (selectedBet / 10) * newMultiplier);

      setCredits(prev => prev + totalWin);
      setWinStreak(newStreak);
      setComboMultiplier(newMultiplier);

      let streakText = newStreak > 1 ? ` 🔥 КОМБО x${newStreak}! (x${newMultiplier.toFixed(1)} множитель)` : '';
      setResult(`🎉 ДЖЕКПОТ! +${totalWin} кредитов!${streakText}`);

      playJackpotSound();
      triggerConfetti(true); // 🎉 Мощное конфетти!
    } else if (finalReels[0] === finalReels[1] || finalReels[1] === finalReels[2] || finalReels[0] === finalReels[2]) {
      // Два одинаковых
      const baseWin = 30;
      const newStreak = winStreak + 1;
      const newMultiplier = Math.min(1 + (newStreak * 0.2), 3);
      const totalWin = Math.floor(baseWin * (selectedBet / 10) * newMultiplier);

      setCredits(prev => prev + totalWin);
      setWinStreak(newStreak);
      setComboMultiplier(newMultiplier);

      let streakText = newStreak > 1 ? ` 🔥 Комбо x${newStreak}!` : '';
      setResult(`✨ Неплохо! +${totalWin} кредитов${streakText}`);

      playWinSound();
      triggerConfetti(false); // 🎉 Обычное конфетти
    } else {
      // Проигрыш - сброс комбо
      setWinStreak(0);
      setComboMultiplier(1);
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

          {/* 🔥 Индикатор комбо */}
          {winStreak > 0 && (
            <div className="combo-indicator">
              🔥 ГОРЯЧАЯ ПОЛОСА: {winStreak} подряд! (x{comboMultiplier.toFixed(1)})
            </div>
          )}

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

          {/* 💰 Выбор ставки */}
          <div className="bet-selector">
            <span className="bet-label">Ставка:</span>
            {BET_AMOUNTS.map(amount => (
              <button
                key={amount}
                className={`bet-button ${selectedBet === amount ? 'active' : ''}`}
                onClick={() => setSelectedBet(amount)}
                disabled={spinning}
              >
                {amount}
              </button>
            ))}
          </div>

          <button
            className="slot-spin-button"
            onClick={spin}
            disabled={spinning || credits < selectedBet}
          >
            {spinning
              ? '🎲 ВРАЩЕНИЕ...'
              : credits < selectedBet
                ? '😢 Недостаточно кредитов'
                : `🎲 КРУТИТЬ (${selectedBet} кредитов)`
            }
          </button>

          <div className="slot-machine-info">
            <p>🍒🍒🍒 = x20 от ставки</p>
            <p>💎💎💎 = x50 от ставки (ДЖЕКПОТ!)</p>
            <p>Два одинаковых = x3 от ставки</p>
            <p>🔥 Комбо: +20% к выигрышу за каждый подряд!</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlotMachineEasterEgg;
