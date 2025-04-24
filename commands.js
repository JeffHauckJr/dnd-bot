const { Client, Intents, MessageEmbed, Util } = require("discord.js");
const axios = require("axios");
const spellFunction = require("./commands/spells")
const classFunction = require("./commands/class")
const raceFunction = require("./commands/race")
const classFeatFunction = require("./commands/classFeat")
const commandFunction = require("./commands/help")
const rollFunction = require("./commands/dieRoll")
const monsterFunction = require("./commands/monsters")
const equipmentFunction = require("./commands/equipment")
const alignmentFunction = require("./commands/alignment")
const encounterFunction = require("./commands/encounter")
const magicFunction = require("./commands/magic")
const rulesFunction = require("./commands/rules")
const stopMusic = require("./commands/stop");
const playLocal = require("./commands/playlocal");
const playYtdlp = require("./commands/playYtdlp");
const showQueue = require("./commands/queue");
const skipSong = require("./commands/skip")

module.exports = async (msg) => {
  const prefix = "~";

  const userId = msg.author.id;

  const botId = "883191824850776104";

  const args = msg.content.slice(prefix.length).trim().split(" ");

  const command = args.shift().toLowerCase();

  if (command === "spell") {
    spellFunction(msg)
  }

  if (command === "class") {
    classFunction(msg)
  }

  if (command === "race") {
    raceFunction(msg)
  }

  if (command === "classfeat") {
    classFeatFunction(msg)
  }

  if (command == "commands") {
    commandFunction(msg)
  }

  if (command === "roll") {
    rollFunction(msg)
  }

  if (command === "monster") {
    monsterFunction(msg)
  }

  if (command === "equipment") {
    equipmentFunction(msg)
  }

  if (command === "alignment") {
    alignmentFunction(msg)
  }

  if (command === "encounter") {
    encounterFunction(msg)
  }

  if (command === "magic") {
    magicFunction(msg)
  }

  if (command === "rules") {
    rulesFunction(msg)
  }

  if (command === "stop") {
    stopMusic(msg);
  }

  if (command === "playlocal") {
    playLocal(msg);
  }

  if (command === "ytplay") {
    playYtdlp(msg);
  }

  if (command === "queue") {
    showQueue(msg);
  }

  if (command === "skip") {
    skipSong(msg);
  }
};
