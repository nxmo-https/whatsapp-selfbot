const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
};

function log(level, message, color = "white") {
  const time = new Date().toLocaleTimeString([], { hour12: false });
  const label = String(level).padEnd(5);
  console.log(`${COLORS.red}[${time}] ${label} ${message}${COLORS.reset}`);
}

function error(level, message, detail) {
  log(level, `${message}${detail ? `: ${detail.message || detail}` : ""}`, "red");
}

module.exports = { log, error };
