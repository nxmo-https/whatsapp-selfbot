const fs = require("fs");
const path = require("path");

function loadCommands() {
  const commands = new Map();
  const commandsDir = path.join(__dirname, "..", "commands");

  for (const file of fs.readdirSync(commandsDir)) {
    if (!file.endsWith(".js")) continue;
    const exported = require(path.join(commandsDir, file));
    const list = Array.isArray(exported) ? exported : [exported];

    for (const cmd of list) {
      if (!cmd.name || typeof cmd.execute !== "function") {
        console.warn(`[commandHandler] Skipping invalid command in ${file}`);
        continue;
      }
      cmd.category = cmd.category || "Misc";
      commands.set(cmd.name, cmd);
    }
  }

  return commands;
}

module.exports = { loadCommands };
