const fs = require("fs");
const path = require("path");


const logsFolder = path.join(process.cwd(), "logs");


if (!fs.existsSync(logsFolder)) {
    fs.mkdirSync(logsFolder, { recursive: true });
}


function getLogFile() {

    const now = new Date();

    const date =
        `${now.getFullYear()}-` +
        `${String(now.getMonth()+1).padStart(2,"0")}-` +
        `${String(now.getDate()).padStart(2,"0")}`;


    return path.join(
        logsFolder,
        `aconex-${date}.txt`
    );
}



function writeToFile(type, args) {

    const timestamp = new Date().toISOString();

    const message =
        `[${timestamp}] [${type}] ` +
        args.map(a =>
            typeof a === "object"
                ? JSON.stringify(a)
                : a
        ).join(" ") +
        "\n";


    fs.appendFileSync(
        getLogFile(),
        message,
        "utf8"
    );
}



const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;



console.log = function(...args){

    writeToFile("INFO", args);

    originalLog.apply(console, args);
};



console.error = function(...args){

    writeToFile("ERROR", args);

    originalError.apply(console, args);
};



console.warn = function(...args){

    writeToFile("WARNING", args);

    originalWarn.apply(console, args);
};