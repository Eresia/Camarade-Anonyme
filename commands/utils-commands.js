const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');

let allCommands = [];

const emptyMessage = "\u200B";
const nbMaxEmbedField = 7;

function buildEmbedCommand()
{
	let command = new SlashCommandBuilder();
	command.setName('embed');
	command.setDescription('Add embed message');
	command.addStringOption(option => 
		option
			.setName('message-id')
			.setDescription('If you want modify a message in the channel')
			.setRequired(false)
	);
	command.addStringOption(option => 
		option
			.setName('title')
			.setDescription('Title of the embed')
			.setRequired(false)
	);
	command.addStringOption(option => 
		option
			.setName('description')
			.setDescription('Description of the embed')
			.setRequired(false)
	);

	for(let i = 1; i <= nbMaxEmbedField; i++)
	{
		command.addStringOption(option => 
			option
				.setName('field' + i + '-title')
				.setDescription('Title of the field ' + i)
				.setRequired(false)
		);

		command.addStringOption(option => 
			option
				.setName('field' + i + '-description')
				.setDescription('Description of the field ' + i)
				.setRequired(false)
		);

		command.addBooleanOption(option => 
			option
				.setName('field' + i + '-inline')
				.setDescription('Is field ' + i + ' inline ?')
				.setRequired(false)
		);
	}

	return command;
}

allCommands.push({
	data: buildEmbedCommand(),

	async execute(interaction, dataManager) {

		let messageId = interaction.options.getString('message-id');
		let message = null;

		if(messageId != null)
		{
			message = await interaction.channel.messages.fetch(messageId);
			if(message == null)
			{
				interaction.reply({content: 'Can\'t find message id ' + messageId, ephemeral: true});
				return;
			}

			if(message.author.id != interaction.client.user.id)
			{
				interaction.reply({content: 'Message has to be one of mine', ephemeral: true});
				return;
			}
		}

		let embed = new EmbedBuilder();

		let title = interaction.options.getString('title');
		let description = interaction.options.getString('description');
		let fields = [];

		for(let i = 1; i <= nbMaxEmbedField; i++)
		{
			let fieldTitle = interaction.options.getString('field' + i + '-title');
			let fieldDescription = interaction.options.getString('field' + i + '-description');
			let fieldInline = interaction.options.getBoolean('field' + i + '-inline');

			if((fieldTitle == null) && (fieldDescription == null))
			{
				continue;
			}

			let field = 
			{
				name: (fieldTitle == null) ? emptyMessage : fieldTitle.replaceAll('\\n', '\n'),
				value: (fieldDescription == null) ? emptyMessage : fieldDescription.replaceAll('\\n', '\n'),
				inline: (fieldInline == null) ? false : fieldInline
			}

			fields.push(field);
		}

		if(title != null)
		{
			embed.setTitle(title.replaceAll('\\n', '\n'));
		}

		if(description != null)
		{
			embed.setDescription(description.replaceAll('\\n', '\n'));
		}

		if(fields.length != 0)
		{
			embed.addFields(fields);
		}

		if(embed.length == 0)
		{
			interaction.reply({content: 'Embed cannot be empty', ephemeral: true});
		}
		else
		{
			if(message == null)
			{
				await interaction.channel.send({ embeds: [embed] });
			}
			else
			{
				await message.edit({ embeds: [embed] });
			}
			
			interaction.reply({content: 'Embed generated', ephemeral: true});
		}
	}
});


module.exports = {
	allCommands
};