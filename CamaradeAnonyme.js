const path = require('path');
const fs = require('fs');
const { Client, Collection, GatewayIntentBits, Events } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const DataManager = require('./scripts/data-manager.js');
const MessageManager = require('./scripts/message-manager.js');
const DiscordUtils = require('./scripts/discord-utils.js');
const { exit } = require('process');

const needRefreshCommands = false;
const sendInitError = true;
const caughtException = true;

if(!fs.existsSync('config.json'))
{
	let basic_config = {};
	basic_config.clientId = "";
	basic_config.token = "";

	fs.writeFileSync('config.json', JSON.stringify(basic_config, null, 4));

	console.log('Need to fill config.json with discord bot informations');
	exit(0);
}

const { clientId, token } = require('./config.json');

if(clientId.length == 0 || token.length == 0)
{
	console.log('Need to fill config.json with discord bot informations');
	exit(0);
}

const guildValues = 
[
	{name : 'errorLogChannel', defaultValue : -1},
	{name : 'anonymousQuestionChannel', defaultValue : -1},
	{name : 'bannedUsers', defaultValue : []},
	{name : 'askChannel', defaultValue : -1},
	{name : 'buttonName', defaultValue: 'Poser une question anonyme'},
	{name : 'modalTitle', defaultValue: 'Question Anonyme'},
	{name : 'modalSentence', defaultValue: 'Posez votre question'},
	{name : 'embedTitle', defaultValue: 'Nouvelle question anonyme'},
];

const rest = new REST({ version: '9' }).setToken(token);
const client = new Client({ intents: 
	[
		GatewayIntentBits.Guilds,
		GatewayIntentBits.DirectMessages,
	] 
});

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

client.commands = new Collection();
let commandData = [];

for (const file of commandFiles) {
	let commands = require(`./commands/${file}`);
	const allCommands = commands.allCommands;

	for(let i = 0; i < allCommands.length; i++)
	{
		client.commands.set(allCommands[i].data.name, allCommands[i]);
		commandData.push(allCommands[i].data.toJSON());
	}
}

DataManager.initData(path.join(__dirname, 'data'), guildValues);
DataManager.MessageManager = MessageManager;

let isInit = false;

client.on('ready', async function () {
	console.log("Connected");

	if (!client.application?.owner) await client.application?.fetch();

	await refreshCommands();

	client.on(Events.InteractionCreate, async function(interaction)
	{
		if(interaction.isModalSubmit())
		{
			switch(interaction.customId)
			{
				case 'anonymous-question-modal':
				{
					let question = interaction.fields.getTextInputValue('question-text');

					await interaction.deferReply({ephemeral: true});

					let result = await MessageManager.askQuestion(DataManager, interaction.guild, interaction.user, question);

					interaction.editReply({content: result, ephemeral: true});
					break;
				}
			}
			return;
		}
		if(!interaction.isCommand() && !interaction.isUserContextMenuCommand())
		{
			return;
		}

		const command = client.commands.get(interaction.commandName);

		if (!command)
		{
			return;
		}

		try 
		{
			await command.execute(interaction, DataManager);
		} 
		catch (executionError) {
			console.error(executionError);
			try 
			{
				await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
				DataManager.logError(interaction.guild, 'Command ' + interaction.commandName + ' Error :\n\n' + executionError);
			} 
			catch(replyError)
			{
				try 
				{
					await interaction.editReply('There was an error while executing this command!');
					DataManager.logError(interaction.guild, 'Command ' + interaction.commandName + ' Error :\n\n' + replyError + '\n' + executionError);
				}
				catch(cantReplyError)
				{
					DataManager.logError(interaction.guild, 'Command ' + interaction.commandName + ' Error : Answer is too long');
				}
			}
		}
	});

	client.on(Events.GuildCreate, function(guild)
	{
		DataManager.initGuildData(guild.id);
		refreshCommandForGuild(guild);
	});

	client.on(Events.GuildDelete, function(guild)
	{
		MessageManager.removeCollector(guild);
		DataManager.removeGuildData(guild.id);
	});

	await client.guilds.fetch();

	if(isInit)
	{
		return;
	}

	client.guilds.cache.forEach(async (guild) => {
		if(sendInitError)
		{
			DataManager.logError(guild, 'Initialisation', false);
		}

		MessageManager.collectQuestions(DataManager, guild);
	});
	
	isInit = true;
});

async function refreshCommands()
{
	await client.guilds.fetch();

	for(let[guildId, guild] of client.guilds.cache)
	{
		if(needRefreshCommands || DataManager.getServerData(guildId) == null)
		{
			DataManager.initGuildData(guildId);
			await refreshCommandForGuild(guild);
		}
	}
}

async function refreshCommandForGuild(guild)
{
	try
	{
		await rest.put(Routes.applicationGuildCommands(clientId, guild.id), { body: commandData });
		console.log('Successfully registered application commands for guild ' + guild.name);
	}
	catch(error)
	{
		console.log('Can\'t registered command for guild ' + guild.name + ': ' + error);
	}
}

async function logError(guild, error, sendGeneralIfNoLogChannel = true)
{
	let guildData = DataManager.getServerData(guild.id);
	let channel = await DiscordUtils.getChannelById(guild.client, guildData.errorLogChannel);

	if(channel != null)
	{
		try
		{
			await channel.send('Info: ' + error);
		}
		catch(error)
		{
			console.log('Can\'t log error : ' + error);
		}
	}
	else if(sendGeneralIfNoLogChannel && guild.id != '1032270436018421811')
	{
		await DataManager.logError(await DiscordUtils.getGuildById(client, '1032270436018421811'), 'Other Guild (' + guild.id + ' - ' + guild.name + ') Error: ' + error);
	}
}

if(caughtException)
{
	process.once('uncaughtException', async function (err)
	{
		await DataManager.logError(await DiscordUtils.getGuildById(client, '1032270436018421811'), 'Uncaught exception: ' + err);
		console.log('Uncaught exception: ' + err);
		exit(1);
	});
}

DataManager.refreshCommandForGuild = refreshCommandForGuild;
DataManager.logError = logError;

client.login(token);