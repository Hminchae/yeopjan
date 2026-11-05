import { useEffect, useRef } from 'react';
import Phaser from 'phaser';

interface Props { onMove: (x: number, y: number) => void }

class MidnightBarScene extends Phaser.Scene {
  create() {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x101522).fillRect(0, 0, 1000, 650);
    graphics.fillStyle(0x172033).fillRect(0, 0, 1000, 142);
    graphics.fillStyle(0x233049).fillRect(70, 28, 275, 150);
    graphics.lineStyle(8, 0x5a3a2f).strokeRect(70, 28, 275, 150);
    graphics.lineStyle(3, 0x6d8298, 0.35);
    for (let x = 90; x < 330; x += 28) graphics.lineBetween(x, 36, x - 30, 170);
    graphics.fillStyle(0x2b211f).fillRect(430, 40, 430, 135);
    graphics.fillStyle(0x7d4a31).fillRect(445, 62, 395, 7);
    graphics.fillStyle(0xa66a3a);
    for (let x = 465; x < 825; x += 32) graphics.fillRoundedRect(x, 78 + (x % 3) * 8, 12, 38, 3);
    graphics.fillStyle(0x8d552f).fillRect(155, 275, 695, 72);
    graphics.fillStyle(0x503426).fillRect(125, 342, 750, 37);
    graphics.lineStyle(5, 0xb78545).lineBetween(155, 276, 850, 276);
    graphics.fillStyle(0x4b332b);
    graphics.fillEllipse(300, 505, 135, 67).fillEllipse(700, 505, 135, 67);
    graphics.fillStyle(0x72523b).fillRect(288, 500, 24, 110).fillRect(688, 500, 24, 110);
    graphics.fillStyle(0x342828).fillRect(0, 380, 1000, 270);
    graphics.lineStyle(2, 0x49352e, 0.65);
    for (let y = 405; y < 650; y += 42) graphics.lineBetween(0, y, 1000, y);
    for (let x = 0; x < 1000; x += 100) graphics.lineBetween(x, 380, x - 70, 650);

    for (const x of [300, 500, 700]) {
      const glow = this.add.circle(x, 180, 92, 0xd99a4c, 0.09);
      this.add.line(0, 0, x, 0, x, 112, 0x8c6a50).setOrigin(0);
      this.add.circle(x, 122, 28, 0xe3aa5b).setStrokeStyle(5, 0x6c4932);
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.tweens.add({ targets: glow, alpha: { from: 0.07, to: 0.14 }, duration: 2300 + x, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      }
    }

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const x = Math.max(4, Math.min(96, pointer.x / 10));
      const y = Math.max(12, Math.min(92, pointer.y / 6.5));
      this.game.events.emit('bar-move', x, y);
    });
  }
}

export function BarScene({ onMove }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    if (!host.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      width: 1000,
      height: 650,
      backgroundColor: '#101522',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: false, pixelArt: true },
      scene: MidnightBarScene,
      audio: { noAudio: true }
    });
    const move = (x: number, y: number) => onMoveRef.current(x, y);
    game.events.on('bar-move', move);
    return () => { game.events.off('bar-move', move); game.destroy(true); };
  }, []);

  return <div className="bar-canvas" ref={host} aria-hidden="true" />;
}
