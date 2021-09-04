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
  const args = msg.content.slice(prefix.length).trim().split(" ");

  const command = args.shift().toLowerCase();

  if (command === "spell" || command === "spells") {
    try {
      const spell = msg.content.split(" ").slice(2).join(" ");

      const indWords = spell.split(" ");

      const joinWords = indWords[0] + "-" + indWords[1];
      console.log(indWords.length);

      const newInput = () => {
        if (indWords.length > 1) {
          console.log("this is joining words");
          return joinWords;
        } else {
          console.log("this is returning 1 word");
          return spell;
        }
      };
      const spellUrl = `https://www.dnd5eapi.co/api/spells/${newInput()}/`;
      const response = await axios.get(spellUrl);
      const data = response.data;
      console.log(data);
      const dmg = data?.damage?.damage_at_slot_level;

      if (!dmg) {
        console.log("this is the if");
        const supportSpellEmbed = new MessageEmbed()
          .setColor("#ff9538")
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
        console.log("This is the else");
        const damageSpellEmbed = new MessageEmbed()
          .setColor("#ff9538")
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
      console.log(data);
      console.log(
        data.proficiency_choices[0].from,
        "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
      );

      const proList = data.proficiencies.map((pro) => {
        const pros = pro.name;
        return `${pros}
        `;
      });

      const proSkillList = data.proficiency_choices[0].from.map((skill) => {
        console.log(skill.name, "!!!!!!!!!!!!!!!!!!!!!!!!");
        return `${skill.name}  
        `;
      });
      const classEmbed = new MessageEmbed()
        .setColor("#ff9538")
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
      console.log(response);
      const data = response.data;
      console.log(data.subraces);
      const racialTraits = data.traits.map((trait) => {
        return `${trait.name}
        `;
      });

      const subraces = data.subraces.map((sub) => {
        return `${sub.name}`;
      });

      const abilityBonuses = data.ability_bonuses.map((abl) => {
        console.log(abl, "!!!!!!!!!!!!!!!!!!!!");
        return `+${abl.bonus} bonus to ${abl.ability_score.name}`;
      });

      const raceEmbed = new MessageEmbed()
        .setColor("#ff9538")
        .setTitle(`Class : ${data.name}`)
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

  if (command === "feat") {
    try {
      const feat = msg.content.split(" ").slice(2).join(" ");

      const indWords = feat.split(" ");

      const join2Words = indWords[0] + "-" + indWords[1];

      const join3Words = indWords[0] + "-" + indWords[1] + "-" + indWords[2];

      const join4Words =
        indWords[0] + "-" + indWords[1] + "-" + indWords[2] + "-" + indWords[3];

      const newInput = () => {
        if (indWords.length === 2) {
          console.log("this is joining 2 words");
          return join2Words;
        } else if (indWords.length === 3) {
          console.log("this is joining 3 words");
          return join3Words;
        } else if (indWords.length === 4) {
          console.log("this is joining 4 words");
          return join4Words;
        } else {
          console.log("this is returning 1 word");
          return feat;
        }
      };
      console.log(feat, "!!!!!!!!!!!!!!!!!!!!!!!");
      const featUrl = `https://www.dnd5eapi.co/api/features/${newInput()}`;
      const response = await axios.get(featUrl);
      const data = response.data;

      const featClass = data.class.name;

      console.log();

      const featEmbed = new MessageEmbed()
        .setColor("#ff9538")
        .setTitle(`Feat : ${data.name}`)
        .setURL()
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
        { name: "Feat", value: `~ feat [feat name]` },
        { name: "Caregul! There are magic rituals under way. These rituals will allow you to ", value: `~ equipment [equipment name]
        ~ monster [monster name]
        ~ rules [rule name]
        Stay tuned Adventurers!` },
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
});

client.login(TOKEN);
