require("dotenv").config();
const { Client, Intents, MessageEmbed } = require("discord.js");
const axios = require("axios");
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MEMBERS,
  ],
});
const TOKEN = process.env.TOKEN;

client.on("ready", () => {
  console.info(`Logged in as ${client.user.tag}!`);
});

const prefix = "~";

client.on("messageCreate", async (msg) => {
  if (msg.content[0] !== prefix) {
    console.log("no prefix");
    return;
  }
  const userId = msg.author.id;

  const botId = "883191824850776104";

  const args = msg.content.slice(prefix.length).trim().split(" ");

  const command = args.shift().toLowerCase();

  if (command === "spell") {
    try {
      const spell = msg.content.split(" ").slice(2).join(" ").toLowerCase();

      const indWords = spell.split(" ");

      const join2Words = indWords[0] + "-" + indWords[1];

      const join3Words = indWords[0] + "-" + indWords[1] + "-" + indWords[2];

      const join4Words =
        indWords[0] + "-" + indWords[1] + "-" + indWords[2] + "-" + indWords[3];

      const spellInput = () => {
        if (indWords.length === 2) {
          return join2Words;
        } else if (indWords.length === 3) {
          return join3Words;
        } else if (indWords.length === 4) {
          return join4Words;
        } else {
          return spell;
        }
      };
      const spellUrl = `https://www.dnd5eapi.co/api/spells/${spellInput()}`;
      const response = await axios.get(spellUrl);
      const data = response.data;
      const dmg = data?.damage?.damage_at_slot_level;

      if (!dmg) {
        const supportSpellEmbed = new MessageEmbed()
          .setColor("#F50B0B")
          .setTitle(`${data.name}`)
          .setURL()
          .addFields(
            {
              name: "Description",
              value: `${data?.name === "Wish" ? data?.desc[1] : data.desc}`,
            },
            { name: "Range", value: `${data.range || "None"}` },
            { name: "Components", value: `${data.components || "None"}` },
            { name: "Materials", value: `${data.material || "None"}` },
            { name: "Duration", value: `${data.duration || "None"}` },
            { name: "Level", value: `${data.level || "None"}` }
          );

        msg.reply({ embeds: [supportSpellEmbed] });
      } else {
        const damageSpellEmbed = new MessageEmbed()
          .setColor("#F50B0B")
          .setTitle(`${data.name}`)
          .setURL()
          .addFields(
            { name: "Description", value: `${data.desc}` },
            { name: "Range", value: `${data.range || "None"}` },
            { name: "Components", value: `${data.components || "None"}` },
            { name: "Materials", value: `${data.material || "None"}` },
            { name: "Duration", value: `${data.duration || "None"}` },
            { name: "Level", value: `${data.level || "None"}` },
            {
              name: "Damage Per Level Slot",
              value: `1: ${data?.damage.damage_at_slot_level[1] || "None"}
              2: ${data?.damage.damage_at_slot_level[2] || "None"}
              3: ${data?.damage.damage_at_slot_level[3] || "None"}
          4: ${data.damage?.damage_at_slot_level[4] || "None"}
        5: ${data.damage?.damage_at_slot_level[5] || "None"}
        6: ${data.damage?.damage_at_slot_level[6] || "None"}
        7: ${data.damage?.damage_at_slot_level[7] || "None"}
        8: ${data.damage?.damage_at_slot_level[8] || "None"}
        9: ${data.damage?.damage_at_slot_level[9] || "None"}`,
            }
          );
        msg.reply({ embeds: [damageSpellEmbed] });
      }
    } catch (error) {
      console.log(error);
      msg.reply("This Spell Is Not A Thing");
    }
  }

  if (command === "class") {
    try {
      const classes = msg.content
        .split(" ")
        .slice(2)
        .join(" ")
        .toLocaleLowerCase();
      const classUrl = `https://www.dnd5eapi.co/api/classes/${classes}`;
      const response = await axios.get(classUrl);
      const data = response.data;

      const proList = data.proficiencies
        .map((pro) => {
          const pros = pro.name;
          return `${pros}
        `;
        })
        .join(" ");

      const proSkillList = data.proficiency_choices[0].from
        .map((skill) => {
          return `${skill.name}  
        `;
        })
        .join(" ");
      const classEmbed = new MessageEmbed()
        .setColor("#F50B0B")
        .setTitle(`Class : ${data.name}`)
        .setURL()
        .addFields(
          { name: "Hit Die", value: `${data.hit_die}` },
          {
            name: `Starting proficiencies where the player ${data.proficiency_choices[0].choose} from the given list of proficiencies.`,
            value: `${proSkillList}` || "Something",
          },
          {
            name: "Starting proficiencies all new characters of this class start with.",
            value: `${proList}` || "Something",
          }
        );
      msg.reply({ embeds: [classEmbed] });
    } catch (err) {
      console.log(err);
      msg.reply("Try a Basic Class");
    }
  }

  if (command === "race") {
    try {
      const race = msg.content
        .split(" ")
        .slice(2)
        .join(" ")
        .toLocaleLowerCase();
      const raceUrl = `https://www.dnd5eapi.co/api/races/${race}`;
      const response = await axios.get(raceUrl);
      const data = response.data;
      const racialTraits = data.traits
        .map((trait) => {
          return `${trait.name}
        `;
        })
        .join(" ");

      const subraces = data.subraces
        .map((sub) => {
          return `${sub.name}`;
        })
        .join(" ");

      const abilityBonuses = data.ability_bonuses
        .map((abl) => {
          return `+${abl.bonus} bonus to ${abl.ability_score.name}`;
        })
        .join(" ");

      const raceEmbed = new MessageEmbed()
        .setColor("#F50B0B")
        .setTitle(`Race : ${data.name}`)
        .setURL()
        .addFields(
          { name: "Ability Bonuses", value: `${abilityBonuses}` || `No Data` },
          {
            name: `Racial Speed`,
            value: `${data.speed}` || "No Data",
          },
          {
            name: "Common Alignment",
            value: `${data.alignment}` || "No Data",
          },
          {
            name: "Size",
            value: `${data.size_description}` || "No Data",
          },
          {
            name: "Racial Traits",
            value: `${racialTraits}` || "No Data",
          },
          {
            name: "Language",
            value: `${data.language_desc}` || "No Data",
          },
          {
            name: "Sub Races",
            value: `${subraces}` || "No Data",
          }
        );

      msg.reply({ embeds: [raceEmbed] });
    } catch (err) {
      console.log(err);
      msg.reply("No information on that race.");
    }
  }

  if (command === "classfeat") {
    try {
      const feat = msg.content.split(" ").slice(2).join(" ").toLowerCase();

      const indWords = feat.split(" ");

      const join2Words = indWords[0] + "-" + indWords[1];

      const join3Words = indWords[0] + "-" + indWords[1] + "-" + indWords[2];

      const join4Words =
        indWords[0] + "-" + indWords[1] + "-" + indWords[2] + "-" + indWords[3];

      const newInput = () => {
        if (indWords.length === 2) {
          return join2Words;
        } else if (indWords.length === 3) {
          return join3Words;
        } else if (indWords.length === 4) {
          return join4Words;
        } else {
          return feat;
        }
      };
      const featUrl = `https://www.dnd5eapi.co/api/features/${newInput()}`;
      const response = await axios.get(featUrl);
      const data = response.data;

      const featClass = data.class.name;

      const featEmbed = new MessageEmbed()
        .setColor("#F50B0B")
        .setTitle(`Class Features : ${data.name}`)
        .addFields(
          {
            name: "Class",
            value: `${featClass}`,
          },
          {
            name: `Level`,
            value: `${data.level}` || "No Data",
          },
          {
            name: "Description",
            value: `${data.desc}` || "No Data",
          },
          {
            name: "Prerequisites",
            value: `${data.prerequisites}` || "No Data",
          }
        );

      msg.reply({ embeds: [featEmbed] });
    } catch (err) {
      console.log(err);
      msg.reply("No feats match that");
    }
  }

  if (command == "commands") {
    const commandEmbed = new MessageEmbed()
      .setColor("#F50B0B")
      .setTitle(
        `
      Hello Weary Traveler, Below are the current knowledge checks I can assist you with.
      `
      )
      .addFields(
        { name: "Race", value: `~ race [race name]` },
        { name: "Class", value: `~ class [class name]` },
        { name: "Spell", value: `~ spell [spell name]` },
        { name: "Equipment", value: `~ equipment [equipment name]` },
        { name: "Monster", value: `~ spell [monster name]` },
        { name: "Class Features", value: `~ classfeat [feat name]` },
        { name: "Dice Roll", value: `~ roll [number of dice 1-9][die 1-100]` },
        {
          name: "Careful! There are magic rituals under way. These rituals will allow you to ",
          value: `~ rules [rule name]
        ~ encounter for a random encounter????
        Stay tuned Adventurers!`,
        },
        {
          name: "Author",
          value: `
          Discord: <@122818058703208450>
          Github: https://github.com/JeffHauckJr 
          `,
        }
      );

    msg.channel.send({ embeds: [commandEmbed] });
  }

  if (command === "roll") {
    const dice = msg.content.split(" ").slice(2).join(" ").toLowerCase();

    //Grad the string that is after the "roll"

    const numOfDie = dice.slice(0, 1);
    const dieNumber = dice.substring(2);
    console.log(dieNumber);
    console.log(numOfDie);

    function rollDice(min, max) {
      return min + Math.floor(Math.random() * (max - min + 1)) * numOfDie;
    }

    const diceRoll = () => {
      return `${rollDice(1, dieNumber)} `;
    };

    msg.reply(diceRoll());
  }

  if (command === "monster") {
    try {
      const monster = msg.content.split(" ").slice(2).join(" ").toLowerCase();

      const indWords = monster.split(" ");

      const join2Words = indWords[0] + "-" + indWords[1];

      const join3Words = indWords[0] + "-" + indWords[1] + "-" + indWords[2];

      const join4Words =
        indWords[0] + "-" + indWords[1] + "-" + indWords[2] + "-" + indWords[3];

      const newInput = () => {
        if (indWords.length === 2) {
          return join2Words;
        } else if (indWords.length === 3) {
          return join3Words;
        } else if (indWords.length === 4) {
          return join4Words;
        } else {
          return monster;
        }
      };

      const monURL = `https://www.dnd5eapi.co/api/monsters/${newInput()}`;
      const response = await axios.get(monURL);
      const data = response.data;
      console.log(data);

      if (data.special_abilities) {
        const specialAbilities = data.special_abilities
          .map((abl) => {
            return `
          Name: ${abl.name || "None"}
          Description: ${abl.desc || "None"} 
          `;
          })
          .join(" ");

        const actions = data.actions
          .map((act) => {
            return `
          Name: ${act.name}
          Description: ${act.desc}
          `;
          })
          .join(" ");

        const monsterEmbed = new MessageEmbed()
          .setColor("#F50B0B")
          .setTitle(`${data.name}`)
          .addFields(
            {
              name: "Size",
              value: `${data.size}`,
              inline: true,
            },
            { name: "Type", value: `${data.type}`, inline: true },
            { name: "Alignment", value: `${data.alignment}`, inline: false },
            { name: "AC", value: `${data.armor_class}`, inline: true },
            { name: "Hit Points", value: `${data.hit_points}`, inline: true },
            { name: "Hit Die", value: `${data.hit_dice}` },
            {
              name: "Ability Scores",
              value: `
          Str: ${data.strength}
          Con: ${data.constitution}
          Int: ${data.intelligence}
          Wis: ${data.wisdom}
          Dex: ${data.dexterity}
          Cha: ${data.charisma}
          `,
            },
            { name: `Languages`, value: `${data.languages || "None"}` },
            {
              name: `Challenge Rating`,
              value: `${data.challenge_rating || "None"}`,
              inline: true,
            },
            { name: `XP`, value: `${data.xp || "None"}`, inline: true }
          );

        const actionEmbed = new MessageEmbed()
          .setColor("#F50B0B")
          .setTitle(`${data.name}`).setDescription(`Special Abilities
             ${specialAbilities} 
            Actions 
            ${actions}`);

        msg
          .reply({ embeds: [monsterEmbed] })
          .then(msg.reply({ embeds: [actionEmbed] }));
      } else if (!data.special_abilities) {
        const monsterEmbed = new MessageEmbed()
          .setColor("#F50B0B")
          .setTitle(`${data.name}`)
          .addFields(
            {
              name: "Size",
              value: `${data.size}`,
              inline: true,
            },
            { name: "Type", value: `${data.type}`, inline: true },
            { name: "Alignment", value: `${data.alignment}`, inline: false },
            { name: "AC", value: `${data.armor_class}`, inline: true },
            { name: "Hit Points", value: `${data.hit_points}`, inline: true },
            { name: "Hit Die", value: `${data.hit_dice}` },
            {
              name: "Ability Scores",
              value: `
          Str: ${data.strength}
          Con: ${data.constitution}
          Int: ${data.intelligence}
          Wis: ${data.wisdom}
          Dex: ${data.dexterity}
          Cha: ${data.charisma}
          `,
            },
            { name: `Languages`, value: `${data.languages || "None"}` },
            {
              name: `Challenge Rating`,
              value: `${data.challenge_rating || "None"}`,
              inline: true,
            },
            { name: `XP`, value: `${data.xp || "None"}`, inline: true }
          );

        msg.reply({ embeds: [monsterEmbed] });
      }
    } catch (err) {
      console.log(err);
      msg.reply(`There are no mosters by that name`);
    }
  }

  if (command === "equipment") {
    try {
      const equipment = msg.content.split(" ").slice(2).join(" ").toLowerCase();

      const indWords = equipment.split(" ");

      const join2Words = indWords[0] + "-" + indWords[1];

      const join3Words = indWords[0] + "-" + indWords[1] + "-" + indWords[2];

      const join4Words =
        indWords[0] + "-" + indWords[1] + "-" + indWords[2] + "-" + indWords[3];

      const newInput = () => {
        if (indWords.length === 2) {
          return join2Words;
        } else if (indWords.length === 3) {
          return join3Words;
        } else if (indWords.length === 4) {
          return join4Words;
        } else {
          return equipment;
        }
      };

      const equipURL = `https://www.dnd5eapi.co/api/equipment/${newInput()}`;
      const response = await axios.get(equipURL);
      const data = response.data;
      console.log(data);

      if (data.armor_category) {
        const armorEmbed = new MessageEmbed()
          .setColor("#F50B0B")
          .setTitle(`${data.name}`)
          .addFields(
            {
              name: `Equipment Category`,
              value: `${data.equipment_category.name}`,
            },
            {
              name: `Armor Category`,
              value: `${data.armor_category}`,
            },
            {
              name: `Armor Class`,
              value: `${data.armor_class.base}`,
            },
            {
              name: `Strength Minimum`,
              value: `${data.str_minimum}`,
            },
            {
              name: `Cost`,
              value: `${data.cost.quantity} ${data.cost.unit}`,
            }
          );
        msg.reply({ embeds: [armorEmbed] });
      } else if (data.damage) {
        const weapondEmbed = new MessageEmbed()
          .setColor("#F50B0B")
          .setTitle(`${data.name}`)
          .addFields(
            {
              name: `Equipment Category`,
              value: `${data.equipment_category.name}`,
            },
            {
              name: `Weapon Category`,
              value: `${data.weapon_category}`,
            },
            {
              name: `Weapon Range`,
              value: ` Normal: ${data.range.normal}
              Long: ${data.range.long ? null : "N/A"}`,
            },
            {
              name: `Damage`,
              value: `
              Dice: ${data.damage.damage_dice}
              Type: ${data.damage.damage_type.name}
              `,
            },
            {
              name: `Properties`,
              value: `${data.properties.map((prop) => {
                return `
                Name:
                 ${prop.name.replace(",", "")}
                 `;
              })}`,
            },
            {
              name: `Cost`,
              value: `${data.cost.quantity} ${data.cost.unit}`,
            }
          );
        msg.reply({ embeds: [weapondEmbed] });
      } else {
        const equipmentEmbed = new MessageEmbed()
          .setColor("#F50B0B")
          .setTitle(`${data.name}`)
          .addFields(
            { name: `Description`, value: `${data.desc || "No Description"}` },
            { name: `Cost`, value: `${data.cost.quantity} ${data.cost.unit}` }
          );

        msg.reply({ embeds: [equipmentEmbed] });
      }
    } catch (err) {
      console.log(err);
      msg.reply("There is no Data on that item");
    }
  }

  if (command === "alignment") {
    try {
      const alignment = msg.content.split(" ").slice(2).join(" ").toLowerCase();

      const indWords = alignment.split(" ");

      const join2Words = indWords[0] + "-" + indWords[1];

      const join3Words = indWords[0] + "-" + indWords[1] + "-" + indWords[2];

      const join4Words =
        indWords[0] + "-" + indWords[1] + "-" + indWords[2] + "-" + indWords[3];

      const newInput = () => {
        if (indWords.length === 2) {
          return join2Words;
        } else if (indWords.length === 3) {
          return join3Words;
        } else if (indWords.length === 4) {
          return join4Words;
        } else {
          return alignment;
        }
      };
      const alignURL = `https://www.dnd5eapi.co/api/alignments/${newInput()}`;
      const response = await axios.get(alignURL);

      const alignEmbed = new MessageEmbed()
        .setColor(`#F50B0B`)
        .setTitle(`${response.data.name}`)
        .setFields({
          name: `Description`,
          value: `${response.data.desc}`,
        });
      msg.reply({ embeds: [alignEmbed] });
    } catch (err) {
      console.log(err);
    }
  }

  if (command === "encounter") {
    try {
      const monURL = `https://www.dnd5eapi.co/api/monsters/`;
      const response = await axios.get(monURL);
      const data = response.data;

      const randomMonster =
        data.results[Math.floor(Math.random() * data.results.length)].name;

      console.log(randomMonster, "!!!!!!!!!!!!!!!!!!!!!!!!!!!");

      const randMonEmbed = new MessageEmbed()
        .setColor(`RED`)
        .setTitle(
          `Your Party has Encountered a/n ${randomMonster}. Roll for initiative.`
        );

      msg.reply({ embeds: [randMonEmbed] });
    } catch (err) {
      console.log(err);
    }
  }
});

client.login(TOKEN);
