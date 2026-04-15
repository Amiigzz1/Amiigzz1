import Phaser from 'phaser';

import { BoardScene } from './scenes/board_scene';
import { readBridgeConfig } from './bridge';

// Entry point — boots a single Phaser scene, forwards config parsed out of
// the URL hash (or window.MajlisBridge, depending on how the host passed it).
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0f1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 720,
    height: 720,
  },
  scene: [new BoardScene(readBridgeConfig())],
};

new Phaser.Game(config);
