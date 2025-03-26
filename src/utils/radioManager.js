// src/utils/radioManager.js
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

const RADIO_CHANNEL_ID = process.env.RADIO_CHANNEL_ID;
const MUSIC_PATH = path.join(__dirname, '../assets/music.ogg');

let voiceConnection = null;
let audioPlayer = null;
let isPlaying = false;

async function startRadio(guild) {
  if (!RADIO_CHANNEL_ID) {
    logger.warn('RADIO_CHANNEL_ID is not set.');
    return;
  }
  const channel = guild.channels.cache.get(RADIO_CHANNEL_ID);
  if (!channel || channel.type !== 2) {
    logger.warn(`Radio channel ID ${RADIO_CHANNEL_ID} is invalid or not a voice channel.`);
    return;
  }
  if (isPlaying) {
    logger.info('Radio is already playing.');
    return;
  }

  logger.info(`Starting radio in channel "${channel.name}"...`);
  voiceConnection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
  });
  audioPlayer = createAudioPlayer();

  audioPlayer.on('stateChange', (oldState, newState) => {
    if (oldState.status === AudioPlayerStatus.Playing && newState.status === AudioPlayerStatus.Idle) {
      logger.info('Music ended, restarting track...');
      playTrack();
    }
  });
  audioPlayer.on('error', (err) => {
    logger.error('Audio player error:', err);
    playTrack(); // Attempt to restart
  });

  voiceConnection.subscribe(audioPlayer);

  try {
    await entersState(voiceConnection, VoiceConnectionStatus.Ready, 15_000);
    logger.info('Voice connection ready. Starting music...');
    playTrack();
    isPlaying = true;
  } catch (err) {
    logger.error('Voice connection not ready:', err);
    stopRadio();
  }
}

function playTrack() {
  if (!audioPlayer) return;
  const resource = createAudioResource(fs.createReadStream(MUSIC_PATH));
  audioPlayer.play(resource);
}

function stopRadio() {
  if (audioPlayer) {
    audioPlayer.stop();
    audioPlayer = null;
  }
  if (voiceConnection) {
    voiceConnection.destroy();
    voiceConnection = null;
  }
  isPlaying = false;
  logger.info('Radio stopped, bot disconnected.');
}

function isRadioPlaying() {
  return isPlaying;
}

module.exports = {
  startRadio,
  stopRadio,
  isRadioPlaying,
};