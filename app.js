require("dotenv").config();
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require("axios");
const commandPrompt = require("./commands");
const { handleCrawlInteraction } = require("./crawl/interactions/handler");
const { connectDatabase } = require("./utils/database");

// Global error handlers to catch silent failures
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection] Promise:', promise, 'Reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Uncaught Exception]', error);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.voiceConnections = new Map();

const TOKEN = process.env.TOKEN;

client.on("ready", async () => {
  console.info(`Logged in as ${client.user.tag}!`);

  // Connect to MongoDB for crawl character storage
  await connectDatabase();
});



client.on("messageCreate", commandPrompt);

// Handle button and menu interactions for the crawl dungeon game
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

  // Route crawl-related interactions
  if (interaction.customId.startsWith('crawl_')) {
    return handleCrawlInteraction(interaction);
  }
});

client.login(TOKEN);
